import { Navigate, Outlet, useLocation } from 'react-router'

import { useSession } from '@/entities/session'
import { PageLoader } from '@/shared/ui/page-loader'

/**
 * Guards the pages that need an account. While the first answer about the
 * session is on its way we show the loader: redirecting first would throw out
 * someone who is in fact signed in.
 */
export const RequireSession = () => {
  const { isSignedIn, isLoading } = useSession()
  const location = useLocation()

  if (isLoading) {
    return <PageLoader />
  }
  if (!isSignedIn) {
    // Remember where they were going, so the sign-in can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
