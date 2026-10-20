/// <reference lib="webworker" />
import {
  createAccount,
  createInboundSession,
  createOutboundSession,
  createSession,
  generateOneTimeKeys,
  identityOf,
  loadOlm,
} from './olm'

import type { OlmAccount, OlmSession } from '@matrix-org/olm'

type Request =
  | { id: number; op: 'createAccount' }
  | { id: number; op: 'unpickleAccount'; pickle: string }
  | { id: number; op: 'pickleAccount' }
  | { id: number; op: 'identity' }
  | { id: number; op: 'sign'; message: string }
  | { id: number; op: 'generateOneTimeKeys'; count: number }
  | { id: number; op: 'markKeysAsPublished' }
  | { id: number; op: 'createOutbound'; chatId: string; identityKey: string; oneTimeKey: string }
  | { id: number; op: 'createInbound'; chatId: string; identityKey: string; body: string }
  | { id: number; op: 'encrypt'; chatId: string; plaintext: string }
  | { id: number; op: 'decrypt'; chatId: string; type: 0 | 1; body: string }
  | { id: number; op: 'pickleSession'; chatId: string }
  | { id: number; op: 'unpickleSession'; chatId: string; pickle: string }

type Response = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: string }

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

const run = async (request: Request): Promise<unknown> => {
  switch (request.op) {
    case 'createAccount':
      account = await createAccount()
      return undefined
    case 'unpickleAccount': {
      await loadOlm()
      const module = await import('@matrix-org/olm')
      const fresh = new module.default.Account()
      fresh.unpickle('orbit-olm-account', request.pickle)
      account = fresh
      return undefined
    }
    case 'pickleAccount':
      return requireAccount().pickle('orbit-olm-account')
    case 'identity':
      return identityOf(requireAccount())
    case 'sign':
      return requireAccount().sign(request.message)
    case 'generateOneTimeKeys':
      return generateOneTimeKeys(requireAccount(), request.count)
    case 'markKeysAsPublished':
      requireAccount().mark_keys_as_published()
      return undefined
    case 'createOutbound': {
      const session = await createOutboundSession(
        requireAccount(),
        request.identityKey,
        request.oneTimeKey,
      )
      sessions.set(request.chatId, session)
      return undefined
    }
    case 'createInbound': {
      const session = await createInboundSession(
        requireAccount(),
        request.identityKey,
        request.body,
      )
      sessions.set(request.chatId, session)
      return undefined
    }
    case 'encrypt':
      return requireSession(request.chatId).encrypt(request.plaintext)
    case 'decrypt':
      return requireSession(request.chatId).decrypt(request.type, request.body)
    case 'pickleSession':
      return requireSession(request.chatId).pickle('orbit-olm-session')
    case 'unpickleSession': {
      const session = await createSession()
      session.unpickle('orbit-olm-session', request.pickle)
      sessions.set(request.chatId, session)
      return undefined
    }
  }
}

addEventListener('message', (event: MessageEvent<Request>) => {
  const request = event.data
  run(request)
    .then((value) => {
      const response: Response = { id: request.id, ok: true, value }
      postMessage(response)
    })
    .catch((error: unknown) => {
      const response: Response = {
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : 'crypto operation failed',
      }
      postMessage(response)
    })
})
