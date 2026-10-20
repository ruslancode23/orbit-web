// Must be evaluated before libolm's bundle: see the file for why.
import './olm-globals'
import Olm from '@matrix-org/olm'
import olmWasmUrl from '@matrix-org/olm/olm.wasm?url'

/**
 * The one place libolm is loaded. The WASM file is a separate chunk: opening a
 * normal channel must not pay for the crypto stack, so this module is imported
 * lazily by the secret chat screen and never by the app shell.
 */
let loading: Promise<void> | undefined

export const loadOlm = async (): Promise<void> => {
  // Vitest runs the emscripten build in Node, which finds its own wasm next to
  // olm.js; the `?url` path is only meaningful in a browser build.
  if (import.meta.env.MODE !== 'test') {
    // libolm's `init(opts)` assigns an undeclared OLM_OPTIONS, which throws in
    // a strict ES module (a known libolm quirk). Setting the global first and
    // calling init() without options is the browser-safe way.
    globalThis.OLM_OPTIONS = { locateFile: () => olmWasmUrl }
  }
  loading ??= Olm.init()
  await loading
}

export interface OlmIdentity {
  /** curve25519: the key other devices encrypt to. */
  identityKey: string
  /** ed25519: signs the registration and the safety number. */
  signingKey: string
}

export interface OlmCiphertext {
  /** 0 is the first message of a session (it carries the pre-key), 1 is a later one. */
  type: 0 | 1
  body: string
}

export const identityOf = (account: Olm.Account): OlmIdentity => {
  const keys: unknown = JSON.parse(account.identity_keys())
  if (typeof keys !== 'object' || keys === null) {
    throw new Error('olm returned no identity keys')
  }
  const { curve25519, ed25519 } = keys as { curve25519?: unknown; ed25519?: unknown }
  if (typeof curve25519 !== 'string' || typeof ed25519 !== 'string') {
    throw new Error('olm returned malformed identity keys')
  }
  return { identityKey: curve25519, signingKey: ed25519 }
}

/**
 * One-time keys are claimed by the server one per bundle; a client keeps a
 * batch published so a sender never has to wait for it to come back online.
 */
export const generateOneTimeKeys = (
  account: Olm.Account,
  count: number,
): { keyId: string; key: string }[] => {
  account.generate_one_time_keys(count)
  const keys: unknown = JSON.parse(account.one_time_keys())
  if (typeof keys !== 'object' || keys === null) {
    throw new Error('olm returned no one-time keys')
  }
  const curve = (keys as { curve25519?: unknown }).curve25519
  if (typeof curve !== 'object' || curve === null) {
    throw new Error('olm returned no curve25519 keys')
  }
  const out: { keyId: string; key: string }[] = []
  for (const [keyId, key] of Object.entries(curve)) {
    if (typeof key === 'string') {
      out.push({ keyId, key })
    }
  }
  return out
}

export const createAccount = async (): Promise<Olm.Account> => {
  await loadOlm()
  const account = new Olm.Account()
  account.create()
  return account
}

export const createSession = async (): Promise<Olm.Session> => {
  await loadOlm()
  return new Olm.Session()
}

export const createInboundSession = async (
  account: Olm.Account,
  senderIdentityKey: string,
  body: string,
): Promise<Olm.Session> => {
  await loadOlm()
  const session = new Olm.Session()
  session.create_inbound_from(account, senderIdentityKey, body)
  // The pre-key is spent: the sender must never reuse it.
  account.remove_one_time_keys(session)
  return session
}

export const createOutboundSession = async (
  account: Olm.Account,
  peerIdentityKey: string,
  peerOneTimeKey: string,
): Promise<Olm.Session> => {
  await loadOlm()
  const session = new Olm.Session()
  session.create_outbound(account, peerIdentityKey, peerOneTimeKey)
  return session
}
