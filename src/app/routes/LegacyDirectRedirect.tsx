import { Navigate, useLocation } from 'react-router'

/**
 * The personal-messages section used to live under `/dm`. Old links, bookmarks
 * and notifications still carry it, so they are sent to `/me` with their path
 * and query intact instead of landing on a missing page.
 */
export const LegacyDirectRedirect = () => {
  const { pathname, search, hash } = useLocation()
  return <Navigate to={`${pathname.replace(/^\/dm/, '/me')}${search}${hash}`} replace />
}
