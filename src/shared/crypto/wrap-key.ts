import { base64ToBytes } from '@/shared/lib/base64'
import type { PlatformSecretStore } from '@/shared/platform'

import { exportWrapKey, generateWrapKey, importWrapKey, type RawKey } from './sealed'

const accountScope = 'secret'

/**
 * The key that seals the Olm pickles.
 *
 * IndexedDB clones a `CryptoKey`, so the browser store keeps the object itself. A file cannot hold
 * that object, so the desktop store keeps the raw bytes instead — inside an AES-GCM file behind
 * the keychain's master key — and the copy used in memory is imported non-extractable.
 */
export const ensureWrapKey = (store: PlatformSecretStore): Promise<CryptoKey> =>
  store.backend === 'keychain' ? ensureKeychainWrapKey(store) : ensureCryptoKey(store)

const ensureCryptoKey = async (store: PlatformSecretStore): Promise<CryptoKey> => {
  const existing = await store.get<CryptoKey>(accountScope, 'wrap', null)
  if (existing) {
    return existing
  }
  const key = await generateWrapKey()
  await store.set(accountScope, 'wrap', key)
  return key
}

const ensureKeychainWrapKey = async (store: PlatformSecretStore): Promise<CryptoKey> => {
  const stored = await store.get<RawKey>(accountScope, 'wrap', null)
  if (stored) {
    return importWrapKey(base64ToBytes(stored.key))
  }
  const generated = await generateWrapKey()
  const raw = await exportWrapKey(generated)
  await store.set<RawKey>(accountScope, 'wrap', { key: raw })
  return importWrapKey(base64ToBytes(raw))
}
