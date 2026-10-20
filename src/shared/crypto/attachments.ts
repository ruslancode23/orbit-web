import { base64ToBytes, bytesToBase64 } from '@/shared/lib/base64'

/** What travels inside the encrypted envelope for one file. */
export interface EncryptedFileMeta {
  /** AES-256-GCM key, base64. Never leaves the encrypted envelope. */
  key: string
  /** 12-byte nonce, base64. */
  iv: string
  name: string
  mimeType: string
  /** Bytes of the plaintext, so the UI can size a preview before decrypting. */
  size: number
}

export interface EncryptedFile {
  /** Ciphertext with the GCM tag appended, ready to upload. */
  blob: Blob
  meta: EncryptedFileMeta
}

const algorithm = 'AES-GCM'
const ivBytes = 12

/** Encrypts a file with a fresh key. The server stores only the ciphertext. */
export const encryptFile = async (file: File): Promise<EncryptedFile> => {
  const key = await crypto.subtle.generateKey({ name: algorithm, length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
  const iv = crypto.getRandomValues(new Uint8Array(ivBytes))
  const plaintext = await file.arrayBuffer()
  const ciphertext = await crypto.subtle.encrypt({ name: algorithm, iv }, key, plaintext)
  const rawKey = await crypto.subtle.exportKey('raw', key)
  return {
    blob: new Blob([ciphertext], { type: 'application/octet-stream' }),
    meta: {
      key: bytesToBase64(new Uint8Array(rawKey)),
      iv: bytesToBase64(iv),
      name: file.name,
      mimeType: file.type,
      size: file.size,
    },
  }
}

/** Decrypts a downloaded ciphertext with the key from the envelope. */
export const decryptFile = async (
  ciphertext: ArrayBuffer,
  meta: EncryptedFileMeta,
): Promise<Blob> => {
  const key = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(meta.key),
    { name: algorithm },
    false,
    ['decrypt'],
  )
  const plaintext = await crypto.subtle.decrypt(
    { name: algorithm, iv: base64ToBytes(meta.iv) },
    key,
    ciphertext,
  )
  return new Blob([plaintext], { type: meta.mimeType })
}
