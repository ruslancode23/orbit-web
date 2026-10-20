import { createDirectEngine } from './direct-engine'

import type { OlmEngine } from './engine'
import type { OlmCiphertext, OlmIdentity } from './olm'

type Operation =
  | { op: 'createAccount' }
  | { op: 'unpickleAccount'; pickle: string }
  | { op: 'pickleAccount' }
  | { op: 'identity' }
  | { op: 'sign'; message: string }
  | { op: 'generateOneTimeKeys'; count: number }
  | { op: 'markKeysAsPublished' }
  | { op: 'createOutbound'; chatId: string; identityKey: string; oneTimeKey: string }
  | { op: 'createInbound'; chatId: string; identityKey: string; body: string }
  | { op: 'encrypt'; chatId: string; plaintext: string }
  | { op: 'decrypt'; chatId: string; type: 0 | 1; body: string }
  | { op: 'pickleSession'; chatId: string }
  | { op: 'unpickleSession'; chatId: string; pickle: string }

type Response = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: string }

/**
 * Runs libolm in a worker so a long ratchet or a 25 MB attachment never blocks
 * typing. The worker holds the account and the sessions; only pickles and
 * ciphertext cross the boundary.
 */
export const createWorkerEngine = (): OlmEngine => {
  if (typeof Worker === 'undefined') {
    return createDirectEngine()
  }
  const worker = new Worker(new URL('./olm.worker.ts', import.meta.url), { type: 'module' })
  let nextId = 1
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >()

  worker.addEventListener('message', (event: MessageEvent<Response>) => {
    const response = event.data
    const entry = pending.get(response.id)
    if (!entry) {
      return
    }
    pending.delete(response.id)
    if (response.ok) {
      entry.resolve(response.value)
    } else {
      entry.reject(new Error(response.error))
    }
  })
  worker.addEventListener('error', () => {
    for (const entry of pending.values()) {
      entry.reject(new Error('the crypto worker failed'))
    }
    pending.clear()
  })

  const request = <T>(operation: Operation): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const id = nextId
      nextId += 1
      pending.set(id, {
        resolve: (value) => {
          resolve(value as T)
        },
        reject,
      })
      worker.postMessage({ id, ...operation })
    })

  return {
    createAccount: () => request<undefined>({ op: 'createAccount' }),
    unpickleAccount: (pickle) => request<undefined>({ op: 'unpickleAccount', pickle }),
    pickleAccount: () => request<string>({ op: 'pickleAccount' }),
    identity: () => request<OlmIdentity>({ op: 'identity' }),
    sign: (message) => request<string>({ op: 'sign', message }),
    generateOneTimeKeys: (count) =>
      request<{ keyId: string; key: string }[]>({ op: 'generateOneTimeKeys', count }),
    markKeysAsPublished: () => request<undefined>({ op: 'markKeysAsPublished' }),
    createOutbound: (chatId, identityKey, oneTimeKey) =>
      request<undefined>({ op: 'createOutbound', chatId, identityKey, oneTimeKey }),
    createInbound: (chatId, identityKey, body) =>
      request<undefined>({ op: 'createInbound', chatId, identityKey, body }),
    encrypt: (chatId, plaintext) => request<OlmCiphertext>({ op: 'encrypt', chatId, plaintext }),
    decrypt: (chatId, type, body) => request<string>({ op: 'decrypt', chatId, type, body }),
    pickleSession: (chatId) => request<string>({ op: 'pickleSession', chatId }),
    unpickleSession: (chatId, pickle) =>
      request<undefined>({ op: 'unpickleSession', chatId, pickle }),
  }
}
