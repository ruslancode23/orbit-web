import { invoke } from '@tauri-apps/api/core'

import { base64ToBytes, bytesToBase64 } from '@/shared/lib/base64'

import type { PlatformSecretStore } from './platform-adapter'

/**
 * The shell's own errors are short codes; the interface promises DOMException names so callers
 * treat "the keychain is locked" as "the person said no", not as "there is no data".
 */
const toError = (error: unknown): DOMException => {
  const code = typeof error === 'string' ? error : String(error)
  const name = code.startsWith('locked')
    ? 'NotAllowedError'
    : code.startsWith('corrupt')
      ? 'DataError'
      : 'NotSupportedError'
  return new DOMException(code, name)
}

const command = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
  try {
    return await invoke<T>(name, args)
  } catch (error) {
    throw toError(error)
  }
}

/** Where a `Blob` was sent: the shell keeps it as its own encrypted file. */
interface BlobRef {
  __orbitBlob: string
}

const isBlobRef = (value: unknown): value is BlobRef =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Record<string, unknown>).__orbitBlob === 'string'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Blob)

/**
 * JSON cannot carry a `Blob`, and a secret chat message carries an attachment as one. Attachments
 * travel as base64 to the shell, which stores them as separate encrypted files next to the
 * message; the value keeps only a reference, so rewriting a message never rewrites the file.
 */
const encode = async (value: unknown, scope: string, key: string): Promise<unknown> => {
  if (value instanceof Blob) {
    const name = crypto.randomUUID()
    const bytes = new Uint8Array(await value.arrayBuffer())
    await command<null>('secret_blob_put', { scope, key, name, data: bytesToBase64(bytes) })
    return { __orbitBlob: name } satisfies BlobRef
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => encode(item, scope, key)))
  }
  if (isPlainObject(value)) {
    const entries = await Promise.all(
      Object.entries(value).map(
        async ([name, item]) => [name, await encode(item, scope, key)] as const,
      ),
    )
    return Object.fromEntries(entries)
  }
  return value
}

const decode = async (value: unknown, scope: string, key: string): Promise<unknown> => {
  if (isBlobRef(value)) {
    const data = await command<string | null>('secret_blob_get', {
      scope,
      key,
      name: value.__orbitBlob,
    })
    // A missing attachment is an empty file rather than a thrown error: one lost picture must not
    // hide the rest of the conversation.
    return new Blob([data === null ? new Uint8Array() : base64ToBytes(data)])
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => decode(item, scope, key)))
  }
  if (isPlainObject(value)) {
    const entries = await Promise.all(
      Object.entries(value).map(
        async ([name, item]) => [name, await decode(item, scope, key)] as const,
      ),
    )
    return Object.fromEntries(entries)
  }
  return value
}

/**
 * Secret chat keys and history behind the OS keychain (DESK-7, ADR-0008).
 *
 * The keychain holds one master key; the shell encrypts every value into its own file and every
 * attachment into a file next to it. This adapter is the only place that knows a `Blob` has to be
 * moved out of the value before it crosses the IPC.
 */
export const createTauriSecretStore = (): PlatformSecretStore => ({
  backend: 'keychain',
  async get<T>(scope: string, key: string, fallback: T | null): Promise<T | null> {
    const wire = await command<unknown>('secret_get', { scope, key })
    if (wire === null || wire === undefined) {
      return fallback
    }
    return (await decode(wire, scope, key)) as T
  },
  async set<T>(scope: string, key: string, value: T): Promise<T> {
    await command<null>('secret_set', { scope, key, value: await encode(value, scope, key) })
    return value
  },
  async remove(scope: string, key: string): Promise<void> {
    await command<null>('secret_remove', { scope, key })
  },
  keys(scope: string): Promise<string[]> {
    return command<string[]>('secret_keys', { scope })
  },
  async clear(scope: string): Promise<void> {
    await command<null>('secret_clear', { scope })
  },
})
