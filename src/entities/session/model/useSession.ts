import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getCurrentUserOptions,
  getCurrentUserQueryKey,
  isApiError,
  type SelfProfile,
} from '@/shared/api'

/** What the app knows about who is signed in. */
export interface Session {
  user: SelfProfile | undefined
  /** True until the first answer about the session arrives. */
  isLoading: boolean
  isSignedIn: boolean
}

/**
 * The current account, asked once and shared by every component: the session
 * lives in an HttpOnly cookie, so only the server can say who it belongs to.
 */
export function useSession(): Session {
  const { data, isPending } = useQuery({
    ...getCurrentUserOptions(),
    // 401 is an answer, not a failure: it means nobody is signed in.
    retry: (failureCount, error) => !isApiError(error) && failureCount < 2,
    staleTime: 5 * 60 * 1000,
  })

  return { user: data, isLoading: isPending, isSignedIn: data !== undefined }
}

/** Forgets everything the signed-in person could see. */
export function useForgetSession(): () => Promise<void> {
  const queryClient = useQueryClient()
  return async () => {
    queryClient.setQueryData(getCurrentUserQueryKey(), undefined)
    // Everything cached was fetched as that account; none of it is ours now.
    await queryClient.resetQueries()
  }
}
