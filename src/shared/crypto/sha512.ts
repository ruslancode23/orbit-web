/**
 * SHA-512 of a UTF-8 string as bytes. WebCrypto is the only primitive here;
 * no hand-written crypto ever runs on a message.
 */
export const createHashLike = async (algorithm: 'SHA-512', value: string): Promise<Uint8Array> => {
  const input = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest(algorithm, input)
  return new Uint8Array(digest)
}
