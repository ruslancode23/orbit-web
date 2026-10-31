import { ensureWrapKey, openWith, sealWith } from '@/shared/crypto'
import { createFakeSecretStore } from '@/shared/lib/test'

import { migrateSecretStore } from './migrate'

const legacyKeys = async () => {
  const legacy = createFakeSecretStore()
  const wrap = await ensureWrapKey(legacy)
  const account = await sealWith(wrap, JSON.stringify({ pickle: 'account' }))
  const session = await sealWith(wrap, JSON.stringify({ pickle: 'session' }))
  await legacy.set('secret', 'device', { deviceId: 'device-1' })
  await legacy.set('secret', 'account', account)
  await legacy.set('secret-chat', 'chat-1', { chat: { id: 'chat-1' }, session })
  return legacy
}

const keychain = () => ({ ...createFakeSecretStore(), backend: 'keychain' as const })

describe('secret store migration', () => {
  it('moves the account and the sessions, then opens them with the new key', async () => {
    const legacy = await legacyKeys()
    const target = keychain()

    await expect(migrateSecretStore(target, legacy)).resolves.toBe(1)

    const movedAccount = await target.get<{ iv: string; data: string }>('secret', 'account', null)
    expect(movedAccount).not.toBeNull()
    const wrap = await ensureWrapKey(target)
    await expect(openWith(wrap, movedAccount as never)).resolves.toContain('account')

    const movedChat = await target.get<{ session: { iv: string; data: string } }>(
      'secret-chat',
      'chat-1',
      null,
    )
    await expect(openWith(wrap, movedChat?.session as never)).resolves.toContain('session')
  })

  it('leaves nothing readable in IndexedDB afterwards', async () => {
    const legacy = await legacyKeys()
    const target = keychain()

    await migrateSecretStore(target, legacy)

    await expect(legacy.get('secret', 'account', null)).resolves.toBeNull()
    await expect(legacy.get('secret', 'wrap', null)).resolves.toBeNull()
    await expect(legacy.keys('secret-chat')).resolves.toEqual([])
  })

  it('does nothing on a second run', async () => {
    const legacy = await legacyKeys()
    const target = keychain()
    await migrateSecretStore(target, legacy)

    await expect(migrateSecretStore(target, legacy)).resolves.toBe(0)
  })

  it('does not touch the browser backend', async () => {
    const legacy = await legacyKeys()

    await expect(migrateSecretStore(createFakeSecretStore(), legacy)).resolves.toBe(0)
    await expect(legacy.get('secret', 'account', null)).resolves.not.toBeNull()
  })
})
