import { base64ToBytes, bytesToBase64 } from '@/shared/lib/base64'

/** AES-GCM ciphertext with its nonce, base64: the form every sealed value is stored in. */
export interface Sealed {
  iv: string
  data: string
}

/** What the keychain-backed store keeps instead of a `CryptoKey`: raw bytes, base64. */
export interface RawKey {
  key: string
}

const algorithm = { name: 'AES-GCM', length: 256 } as const

export const sealWith = async (key: CryptoKey, plain: string): Promise<Sealed> => {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain),
  )
  return { iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(ciphertext)) }
}

export const openWith = async (key: CryptoKey, sealed: Sealed): Promise<string> => {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(sealed.iv) },
    key,
    base64ToBytes(sealed.data),
  )
  return new TextDecoder().decode(plaintext)
}

/** A `CryptoKey` as the interface promises: it never leaves memory in extractable form. */
export const importWrapKey = (raw: BufferSource): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', raw, algorithm, false, ['encrypt', 'decrypt'])

export const exportWrapKey = async (key: CryptoKey): Promise<string> => {
  const raw = await crypto.subtle.exportKey('raw', key)
  return bytesToBase64(new Uint8Array(raw))
}

export const generateWrapKey = async (): Promise<CryptoKey> =>
  crypto.subtle.generateKey(algorithm, true, ['encrypt', 'decrypt'])
