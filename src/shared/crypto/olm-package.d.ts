/**
 * `@matrix-org/olm` ships libolm's emscripten build with UMD-style typings that
 * expose the classes only on the global namespace, not as module exports. The
 * server never sees these objects: this declaration is the exact surface the
 * app uses, so the rest of the code stays typed without `any`.
 */
declare module '@matrix-org/olm' {
  export interface OlmAccount {
    create(): void
    free(): void
    identity_keys(): string
    sign(message: string | Uint8Array): string
    one_time_keys(): string
    generate_one_time_keys(count: number): void
    remove_one_time_keys(session: OlmSession): void
    mark_keys_as_published(): void
    max_number_of_one_time_keys(): number
    pickle(key: string | Uint8Array): string
    unpickle(key: string | Uint8Array, pickle: string): void
    generate_fallback_key(): void
    fallback_key(): string
    unpublished_fallback_key(): string
    forget_old_fallback_key(): void
  }

  export interface OlmSession {
    describe(): string
    free(): void
    pickle(key: string | Uint8Array): string
    unpickle(key: string | Uint8Array, pickle: string): void
    create_outbound(account: OlmAccount, theirIdentityKey: string, theirOneTimeKey: string): void
    create_inbound(account: OlmAccount, preKeyMessage: string): void
    create_inbound_from(account: OlmAccount, identityKey: string, preKeyMessage: string): void
    session_id(): string
    has_received_message(): boolean
    matches_inbound(preKeyMessage: string): boolean
    matches_inbound_from(identityKey: string, preKeyMessage: string): boolean
    encrypt(plaintext: string): { type: 0 | 1; body: string }
    decrypt(messageType: number, message: string): string
  }

  export interface OlmUtility {
    free(): void
    sha256(input: string | Uint8Array): string
    ed25519_verify(key: string, message: string | Uint8Array, signature: string): void
  }

  export interface OlmModule {
    init(options?: { locateFile?: (file: string) => string }): Promise<void>
    Account: new () => OlmAccount
    Session: new () => OlmSession
    Utility: new () => OlmUtility
    get_library_version(): [number, number, number]
  }

  const olm: OlmModule
  export default olm
}
