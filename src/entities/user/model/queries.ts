import { useQuery, useQueryClient } from '@tanstack/react-query'

import { getUserProfile, getUserProfileQueryKey, isApiError, type UserProfile } from '@/shared/api'

import type { QueryClient } from '@tanstack/react-query'

/** Cache entries that already carry someone's profile, so it need not be asked for again. */
const PROFILE_SOURCE_QUERY_IDS = new Set([
  'getCurrentUser',
  'getUserProfile',
  'getConversation',
  'listConversations',
  'listMessages',
  'listWorkspaceBans',
  'listWorkspaceMembers',
])

/** The name of a generated query, stored in the first part of its key. */
const queryId = (queryKey: readonly unknown[]): string | undefined => {
  const params = queryKey[0]
  if (typeof params !== 'object' || params === null || !('_id' in params)) {
    return undefined
  }
  return typeof params._id === 'string' ? params._id : undefined
}

/** Whether a value is a profile, and not just some object with an id. */
const isProfile = (value: object): value is UserProfile => {
  const field = (key: string): unknown => Object.getOwnPropertyDescriptor(value, key)?.value
  return (
    typeof field('id') === 'string' &&
    typeof field('nickname') === 'string' &&
    typeof field('displayName') === 'string' &&
    typeof field('accentColor') === 'string'
  )
}

/**
 * Looks through the cached members, conversations and feed for one account.
 * A profile travels inside those answers, so opening `useUserProfile` next to
 * a loaded member list or history costs no request.
 */
const findProfileIn = (value: unknown, userId: string): UserProfile | undefined => {
  if (typeof value !== 'object' || value === null || value instanceof Date) {
    return undefined
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProfileIn(item, userId)
      if (found) {
        return found
      }
    }
    return undefined
  }
  if (isProfile(value) && value.id === userId) {
    return value
  }
  for (const item of Object.values(value)) {
    const found = findProfileIn(item, userId)
    if (found) {
      return found
    }
  }
  return undefined
}

/** A profile that is already in the cache, from lists, a dialogue or the feed. */
export const findCachedProfile = (
  queryClient: QueryClient,
  userId: string,
): UserProfile | undefined => {
  const queries = queryClient.getQueryCache().findAll({
    predicate: (query) => {
      const id = queryId(query.queryKey)
      return id !== undefined && PROFILE_SOURCE_QUERY_IDS.has(id)
    },
  })
  for (const query of queries) {
    const found = findProfileIn(query.state.data, userId)
    if (found) {
      return found
    }
  }
  return undefined
}

/**
 * One account's public profile. A loaded member list, dialogue or history
 * already carries it; otherwise the server is asked. A 404 means the person
 * is not visible to the reader — there is no profile here, not an error.
 * `user.updated` replaces the cached profile, so the answer stays fresh.
 */
export function useUserProfile(userId: string | undefined) {
  const queryClient = useQueryClient()
  const id = userId ?? ''

  return useQuery({
    queryKey: getUserProfileQueryKey({ path: { userId: id } }),
    queryFn: async ({ signal }) => {
      try {
        const { data } = await getUserProfile({
          path: { userId: id },
          signal,
          throwOnError: true,
        })
        return data
      } catch (error) {
        if (isApiError(error) && error.status === 404) {
          return null
        }
        throw error
      }
    },
    enabled: id !== '',
    initialData: () => (id === '' ? undefined : findCachedProfile(queryClient, id)),
    // Until `user.updated` says otherwise, the cached copy is the same profile.
    staleTime: 5 * 60 * 1000,
  })
}
