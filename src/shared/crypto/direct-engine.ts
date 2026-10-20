import {
  createAccount,
  createInboundSession,
  createOutboundSession,
  createSession,
  generateOneTimeKeys,
  identityOf,
  loadOlm,
} from './olm'

import type { OlmEngine } from './engine'
import type { OlmAccount, OlmSession } from '@matrix-org/olm'

/**
 * The engine without a worker: the same operations on the main thread. Tests
 * use it, and a browser without workers falls back to it rather than failing.
 */
export const createDirectEngine = (): OlmEngine => {
  let account: OlmAccount | null = null
  const sessions = new Map<string, OlmSession>()

  const requireAccount = (): OlmAccount => {
    if (!account) {
      throw new Error('the olm account is not created')
    }
    return account
  }
  const requireSession = (chatId: string): OlmSession => {
    const session = sessions.get(chatId)
    if (!session) {
      throw new Error(`no olm session for ${chatId}`)
    }
    return session
  }

  return {
    async createAccount() {
      account = await createAccount()
    },
    async unpickleAccount(pickle) {
      await loadOlm()
      const fresh = new (await import('@matrix-org/olm')).default.Account()
      fresh.unpickle('orbit-olm-account', pickle)
      account = fresh
    },
    pickleAccount: () => Promise.resolve(requireAccount().pickle('orbit-olm-account')),
    identity: () => Promise.resolve(identityOf(requireAccount())),
    sign: (message) => Promise.resolve(requireAccount().sign(message)),
    generateOneTimeKeys: (count) => Promise.resolve(generateOneTimeKeys(requireAccount(), count)),
    markKeysAsPublished: () => {
      requireAccount().mark_keys_as_published()
      return Promise.resolve()
    },
    async createOutbound(chatId, identityKey, oneTimeKey) {
      const session = await createOutboundSession(requireAccount(), identityKey, oneTimeKey)
      sessions.set(chatId, session)
    },
    async createInbound(chatId, identityKey, body) {
      const session = await createInboundSession(requireAccount(), identityKey, body)
      sessions.set(chatId, session)
    },
    encrypt: (chatId, plaintext) => Promise.resolve(requireSession(chatId).encrypt(plaintext)),
    decrypt: (chatId, type, body) => Promise.resolve(requireSession(chatId).decrypt(type, body)),
    pickleSession: (chatId) => Promise.resolve(requireSession(chatId).pickle('orbit-olm-session')),
    async unpickleSession(chatId, pickle) {
      const session = await createSession()
      session.unpickle('orbit-olm-session', pickle)
      sessions.set(chatId, session)
    },
    forgetSession: (chatId) => {
      const session = sessions.get(chatId)
      session?.free()
      sessions.delete(chatId)
      return Promise.resolve()
    },
  }
}
