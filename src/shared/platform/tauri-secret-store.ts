import { invoke } from '@tauri-apps/api/core'

import { createWebSecretStore } from './web-secret-store'

import type { PlatformSecretStore } from './platform-adapter'

/** The message history keeps its attachments as `Blob`s, which cannot cross the IPC as JSON. */
const MESSAGES_SCOPE = 'secret-messages'

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

/**
 * Secret chat keys behind the OS keychain (DESK-7, ADR-0008).
 *
 * The keychain holds one master key; the shell encrypts every value into its own file. Only the
 * account, the wrap key and the per-chat sessions go here. The message history stays in IndexedDB
 * for now: it carries file attachments as `Blob`s, and JSON cannot move them — a binary channel
 * is the next step, recorded in the ADR.
 */
export const createTauriSecretStore = (): PlatformSecretStore => {
  const keychain: PlatformSecretStore = {
    backend: 'keychain',
    async get<T>(scope: string, key: string, fallback: T | null): Promise<T | null> {
      const value = await command<T | null>('secret_get', { scope, key })
      return value ?? fallback
    },
    set<T>(scope: string, key: string, value: T): Promise<T> {
      return command<null>('secret_set', { scope, key, value }).then(() => value)
    },
    remove(scope: string, key: string): Promise<void> {
      return command<null>('secret_remove', { scope, key }).then(() => undefined)
    },
    keys(scope: string): Promise<string[]> {
      return command<string[]>('secret_keys', { scope })
    },
    clear(scope: string): Promise<void> {
      return command<null>('secret_clear', { scope }).then(() => undefined)
    },
  }

  const history = createWebSecretStore()

  // One store with two homes: the routing is by scope, not by call, so the rest of the app keeps
  // seeing a single `PlatformSecretStore`.
  const store: PlatformSecretStore = {
    backend: 'keychain',
    get: (scope, key, fallback) =>
      scope === MESSAGES_SCOPE
        ? history.get(scope, key, fallback)
        : keychain.get(scope, key, fallback),
    set: (scope, key, value) =>
      scope === MESSAGES_SCOPE ? history.set(scope, key, value) : keychain.set(scope, key, value),
    remove: (scope, key) =>
      scope === MESSAGES_SCOPE ? history.remove(scope, key) : keychain.remove(scope, key),
    keys: (scope) => (scope === MESSAGES_SCOPE ? history.keys(scope) : keychain.keys(scope)),
    clear: (scope) => (scope === MESSAGES_SCOPE ? history.clear(scope) : keychain.clear(scope)),
  }

  return store
}

/** The history half, used by the migration to leave attachments where they are. */
export const secretHistoryStore = (): PlatformSecretStore => createWebSecretStore()
