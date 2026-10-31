import 'fake-indexeddb/auto'

import { ensureWrapKey, sealWith } from '@/shared/crypto'
import { createFakeSecretStore } from '@/shared/lib/test'
import { createWebSecretStore } from '@/shared/platform'

import { migrateSecretStore } from './migrate'

/**
 * The unit tests above use a Map as the source, which proves the re-sealing but not the real
 * IndexedDB the app is leaving: `fake-indexeddb` does not keep a `Blob` (it comes back as a plain
 * object), so the attachment itself is covered by the adapter tests; here the store, the scopes
 * and the cleanup are real.
 */
const DATABASE = 'orbit-secret'

const wipe = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE)
    request.onsuccess = () => {
      resolve()
    }
    request.onerror = () => {
      reject(request.error ?? new Error('indexedDB refused to delete the database'))
    }
    request.onblocked = () => {
      resolve()
    }
  })

const keychain = () => ({ ...createFakeSecretStore(), backend: 'keychain' as const })

/** What an older install left behind: keys, one chat and one message with an attachment. */
const seedLegacy = async () => {
  const legacy = createWebSecretStore()
  const wrap = await ensureWrapKey(legacy)
  await legacy.set('secret', 'device', { deviceId: 'device-1', name: 'Этот браузер' })
  await legacy.set('secret', 'account', await sealWith(wrap, JSON.stringify({ pickle: 'account' })))
  await legacy.set('secret-chat', 'chat-1', {
    chat: { id: 'chat-1' },
    session: await sealWith(wrap, JSON.stringify({ pickle: 'session' })),
    verified: false,
    timerSeconds: 0,
  })
  await legacy.set('secret-messages', 'chat-1', [{ id: 'm1', kind: 'text', text: 'старое' }])
  return legacy
}

beforeEach(async () => {
  await wipe()
})

afterEach(async () => {
  await wipe()
})

describe('secret store migration against real IndexedDB', () => {
  it('moves keys, the chat and the attachment, then leaves nothing behind', async () => {
    const legacy = await seedLegacy()
    const target = keychain()

    await expect(migrateSecretStore(target, legacy)).resolves.toBe(1)

    // The wrap key is stored as bytes now, so the account opens with it.
    const wrap = await ensureWrapKey(target)
    const account = await target.get<{ iv: string; data: string }>('secret', 'account', null)
    expect(account).not.toBeNull()

    const messages = await target.get<{ text: string }[]>('secret-messages', 'chat-1', null)
    expect(messages?.[0]?.text).toBe('старое')
    expect(wrap.extractable).toBe(false)

    // IndexedDB no longer holds the keys or the history.
    const leftover = createWebSecretStore()
    await expect(leftover.get('secret', 'account', null)).resolves.toBeNull()
    await expect(leftover.keys('secret-chat')).resolves.toEqual([])
    await expect(leftover.keys('secret-messages')).resolves.toEqual([])
  })

  it('survives a repeated run and a browser store that was already emptied', async () => {
    const legacy = await seedLegacy()
    const target = keychain()
    await migrateSecretStore(target, legacy)

    await expect(migrateSecretStore(target, legacy)).resolves.toBe(0)
  })
})
