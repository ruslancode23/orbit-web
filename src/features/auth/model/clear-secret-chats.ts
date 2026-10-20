import { revokeDevice } from '@/shared/api'
import { getPlatform } from '@/shared/platform'

/**
 * Signing out ends the secret chats of this browser: the local keys, sessions
 * and messages go first, then the device is revoked on the server so the peer
 * sees it gone. A failed revoke (offline, expired session) must not keep the
 * person signed in, and nothing readable may outlive the session.
 */
export const clearSecretChats = async (): Promise<void> => {
  const store = getPlatform().secretStore
  const device = await store.get<{ deviceId: string }>('secret', 'device', null)

  await store.clear('secret')
  await store.clear('secret-chat')
  await store.clear('secret-messages')

  if (!device) {
    return
  }
  try {
    await revokeDevice({
      path: { deviceId: device.deviceId },
      signal: AbortSignal.timeout(2000),
    })
  } catch {
    // The server copy is a stale device row with no private keys; a later
    // cleanup or revoke is enough.
  }
}
