/** The link people paste into a chat: the code is the whole of it. */
export const inviteUrl = (code: string): string =>
  new URL(`/invite/${encodeURIComponent(code)}`, globalThis.location.origin).toString()
