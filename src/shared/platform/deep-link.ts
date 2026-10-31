/**
 * Where an `orbit://` link points inside the app (DESK-8).
 *
 * Only invitations are accepted: the URL arrives from outside the app, so anything else — a
 * crafted host, a path with a scheme — must not become a navigation.
 */
export const deepLinkPath = (url: string): string | null => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'orbit:' || parsed.hostname !== 'invite') {
    return null
  }
  const code = parsed.pathname.replace(/^\/+|\/+$/gu, '')
  // A code is one path segment of letters, digits, `_` and `-`; anything else is not a code.
  return /^[\w-]+$/u.test(code) ? `/invite/${code}` : null
}
