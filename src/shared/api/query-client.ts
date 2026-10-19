import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { isApiError } from './api-error'
import { getCurrentUserQueryKey } from './generated/@tanstack/react-query.gen'

const MAX_RETRIES = 2

/** Retry network failures and 5xx; a 4xx will fail the same way again. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) {
    return false
  }
  return !(isApiError(error) && error.isClientError)
}

/** 401 anywhere means the session is gone: expired, revoked or signed out elsewhere. */
export function isSessionExpired(error: unknown): boolean {
  return isApiError(error) && error.status === 401
}

export function createQueryClient(): QueryClient {
  // The caches are built before the client exists, so they reach it through
  // this holder, filled in a line below.
  const holder: { client?: QueryClient } = {}

  // A 401 on any request drops what was cached for that account and marks the
  // session as gone; the route guard sees it and sends the person to sign in.
  const forgetSession = (error: unknown) => {
    const queryClient = holder.client
    if (!isSessionExpired(error) || !queryClient) {
      return
    }
    if (queryClient.getQueryData(getCurrentUserQueryKey()) === undefined) {
      return
    }
    queryClient.setQueryData(getCurrentUserQueryKey(), undefined)
    queryClient.removeQueries({
      predicate: (query) => query.queryKey !== getCurrentUserQueryKey(),
    })
  }

  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: forgetSession,
    }),
    mutationCache: new MutationCache({
      onError: forgetSession,
    }),
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
  holder.client = queryClient
  return queryClient
}
