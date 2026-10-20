import type { OlmCiphertext, OlmIdentity } from './olm'

/**
 * The crypto operations the app needs, with the account and the sessions held
 * on the other side of the boundary. The real implementation runs in a Web
 * Worker; tests use a direct one so no worker is needed in jsdom.
 */
export interface OlmEngine {
  createAccount: () => Promise<void>
  unpickleAccount: (pickle: string) => Promise<void>
  pickleAccount: () => Promise<string>
  identity: () => Promise<OlmIdentity>
  sign: (message: string) => Promise<string>
  generateOneTimeKeys: (count: number) => Promise<{ keyId: string; key: string }[]>
  markKeysAsPublished: () => Promise<void>
  createOutbound: (chatId: string, identityKey: string, oneTimeKey: string) => Promise<void>
  /** Also spends the pre-key on the account, as Olm requires. */
  createInbound: (chatId: string, identityKey: string, body: string) => Promise<void>
  encrypt: (chatId: string, plaintext: string) => Promise<OlmCiphertext>
  decrypt: (chatId: string, type: 0 | 1, body: string) => Promise<string>
  pickleSession: (chatId: string) => Promise<string>
  unpickleSession: (chatId: string, pickle: string) => Promise<void>
}
