import { QueryClient } from '@tanstack/react-query'

import { isApiError } from './api-error'

const MAX_RETRIES = 2

/** Retry network failures and 5xx; a 4xx will fail the same way again. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false
  return !(isApiError(error) && error.isClientError)
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
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
}
