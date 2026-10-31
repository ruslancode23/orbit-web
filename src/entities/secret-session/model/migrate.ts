import { ensureWrapKey, openWith, sealWith, type Sealed } from '@/shared/crypto'
import { createWebSecretStore, type PlatformSecretStore } from '@/shared/platform'

import { SecretKeyError } from './session'

import type { SecretChatState } from './session'

const accountScope = 'secret'
const chatScope = 'secret-chat'

/**
 * Moves the keys of an existing browser install out of IndexedDB (DESK-7).
 *
 * The history is not touched: its attachments are `Blob`s and stay where they are. The account is
 * written last, so an interrupted run leaves nothing that looks migrated and simply runs again.
 * The old values are removed only after the new ones decrypt.
 */
export async function migrateSecretStore(
  target: PlatformSecretStore,
  legacy: PlatformSecretStore = createWebSecretStore(),
): Promise<number> {
  if (target.backend !== 'keychain') {
    return 0
  }

  const legacyAccount = await legacy.get<Sealed>(accountScope, 'account', null)
  if (legacyAccount === null) {
    return 0
  }
  if ((await target.get<Sealed>(accountScope, 'account', null)) !== null) {
    return 0
  }

  const legacyWrap = await legacy.get<CryptoKey>(accountScope, 'wrap', null)
  if (!legacyWrap) {
    // Without the old wrap the pickles cannot be opened: say so instead of registering a new device.
    throw new SecretKeyError('Ключи секретных чатов на этом устройстве повреждены.')
  }

  const newWrap = await ensureWrapKey(target)
  const reseal = async (sealed: Sealed): Promise<Sealed> =>
    sealWith(newWrap, await openWith(legacyWrap, sealed))

  const device = await legacy.get<unknown>(accountScope, 'device', null)
  const chats: string[] = await legacy.keys(chatScope)
  for (const id of chats) {
    const state = await legacy.get<SecretChatState>(chatScope, id, null)
    if (state === null) {
      continue
    }
    const moved: SecretChatState = state.session
      ? { ...state, session: await reseal(state.session) }
      : state
    await target.set(chatScope, id, moved)
  }

  const resealedAccount = await reseal(legacyAccount)
  if (device !== null) {
    await target.set(accountScope, 'device', device)
  }
  await target.set(accountScope, 'account', resealedAccount)

  // Prove the move before deleting anything: open the account and one session with the new key.
  await openWith(newWrap, resealedAccount)
  for (const id of chats) {
    const moved = await target.get<SecretChatState>(chatScope, id, null)
    if (moved?.session) {
      await openWith(newWrap, moved.session)
    }
  }

  await legacy.clear(chatScope)
  await legacy.remove(accountScope, 'account')
  await legacy.remove(accountScope, 'wrap')
  await legacy.remove(accountScope, 'device')
  return chats.length
}
