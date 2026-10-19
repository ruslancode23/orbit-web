import { useSearchParams } from 'react-router'

/** Only a path inside this app: `//host` and absolute URLs are not destinations. */
const isInternal = (path: string): boolean => path.startsWith('/') && !path.startsWith('//')

/**
 * Where to go after signing in or up. The invite page sends people here with
 * `?next=`, so a newcomer who chose an account instead of a guest name comes
 * back to the link instead of landing on an empty home.
 */
export const useReturnPath = (): string => {
  const [params] = useSearchParams()
  const next = params.get('next')
  return next !== null && isInternal(next) ? next : '/'
}
