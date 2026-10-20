import type { PlatformSecretStore } from '@/shared/platform'

/**
 * The public half of this browser's secret chat device. It is stored without
 * encryption: it is what the server already knows, and the private keys never
 * leave their sealed pickles.
 */
export interface StoredSecretDevice {
  deviceId: string
  userId: string
  name: string
  identityKey: string
  signingKey: string
}

export const SECRET_SCOPE = 'secret'

/** Which device of this browser holds the keys, if one was ever created. */
export const readSecretDevice = (store: PlatformSecretStore): Promise<StoredSecretDevice | null> =>
  store.get<StoredSecretDevice>(SECRET_SCOPE, 'device', null)
