import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  acceptFriendRequestMutation,
  blockUserMutation,
  createFriendRequestMutation,
  deleteFriendRequestMutation,
  getUserProfileOptions,
  isApiError,
  listFriendRequestsOptions,
  listFriendsOptions,
  listUserBlocksOptions,
  removeFriendMutation,
  unblockUserMutation,
  type Friend,
  type FriendRequestDirection,
  type UserProfile,
} from '@/shared/api'
import { useToast } from '@/shared/ui/toast'

/** The name of a generated query, stored in the first part of its key. */
const queryId = (queryKey: readonly unknown[]): string | undefined => {
  const params = queryKey[0]
  if (typeof params !== 'object' || params === null || !('_id' in params)) {
    return undefined
  }
  return typeof params._id === 'string' ? params._id : undefined
}

/** A query answer that is a list; a broken answer is drawn as an empty one, not a crash. */
export const asList = <T>(data: T[] | undefined): T[] => {
  return Array.isArray(data) ? data : []
}

/** Everybody this account is friends with, with the presence the server knows. */
export const useFriends = () => useQuery(listFriendsOptions())

/** One side of the pending requests: incoming ones to answer, outgoing ones to cancel. */
export const useFriendRequests = (direction: FriendRequestDirection) =>
  useQuery(listFriendRequestsOptions({ query: { direction } }))

/** The accounts this account blocked, most recently blocked first. */
export const useBlockedUsers = () => useQuery(listUserBlocksOptions())

/** How many people are waiting for an answer; the rail badge and the tab use it. */
export const useIncomingFriendRequestCount = (): number => {
  const { data } = useFriendRequests('incoming')
  return Array.isArray(data) ? data.length : 0
}

/**
 * Public profiles of friends, by account id.
 *
 * `GET /friends` carries the handle and presence only, so the picture and the
 * custom status come from the profile endpoint the rest of the app already
 * uses. One request per friend, shared with the member lists through the same
 * cache.
 */
export const useFriendProfiles = (friends: readonly Friend[]): ReadonlyMap<string, UserProfile> => {
  return useQueries({
    queries: friends.map((friend) => ({
      ...getUserProfileOptions({ path: { userId: friend.id } }),
      staleTime: 5 * 60 * 1000,
    })),
    combine: (results) => {
      const profiles = new Map<string, UserProfile>()
      results.forEach((result, index) => {
        const friend = friends[index]
        if (friend && result.data) {
          profiles.set(friend.id, result.data)
        }
      })
      return profiles
    },
  })
}

/** The sentence a failed friendship action shows: the server's words, or a fallback. */
const failureMessage = (error: unknown, fallback: string): string => {
  return isApiError(error) && error.message !== '' ? error.message : fallback
}

/**
 * Every action on a friendship, with the lists refreshed after it. A refusal
 * is reported where the click happened; nothing is left looking done when the
 * server said no.
 */
export const useFriendActions = () => {
  const queryClient = useQueryClient()
  const toast = useToast()

  const invalidate = (ids: readonly string[]) => {
    void queryClient.invalidateQueries({
      predicate: (query) => {
        const id = queryId(query.queryKey)
        return id !== undefined && ids.includes(id)
      },
    })
  }

  const accept = useMutation({
    ...acceptFriendRequestMutation(),
    onSuccess: () => {
      invalidate(['listFriends', 'listFriendRequests'])
    },
  })
  const decline = useMutation({
    ...deleteFriendRequestMutation(),
    onSuccess: () => {
      invalidate(['listFriendRequests'])
    },
  })
  const remove = useMutation({
    ...removeFriendMutation(),
    onSuccess: () => {
      invalidate(['listFriends', 'listFriendRequests'])
    },
  })
  const block = useMutation({
    ...blockUserMutation(),
    onSuccess: () => {
      invalidate(['listFriends', 'listFriendRequests', 'listUserBlocks'])
    },
  })
  const unblock = useMutation({
    ...unblockUserMutation(),
    onSuccess: () => {
      invalidate(['listUserBlocks'])
    },
  })

  return {
    acceptRequest: (userId: string) => {
      accept.mutate(
        { path: { userId } },
        {
          onError: (error) => {
            toast(failureMessage(error, 'Не удалось принять заявку. Попробуйте ещё раз.'), 'danger')
          },
        },
      )
    },
    declineRequest: (userId: string) => {
      decline.mutate(
        { path: { userId } },
        {
          onError: (error) => {
            toast(
              failureMessage(error, 'Не удалось отклонить заявку. Попробуйте ещё раз.'),
              'danger',
            )
          },
        },
      )
    },
    cancelRequest: (userId: string) => {
      decline.mutate(
        { path: { userId } },
        {
          onError: (error) => {
            toast(
              failureMessage(error, 'Не удалось отменить заявку. Попробуйте ещё раз.'),
              'danger',
            )
          },
        },
      )
    },
    removeFriend: (userId: string) => {
      remove.mutate(
        { path: { userId } },
        {
          onError: (error) => {
            toast(
              failureMessage(error, 'Не удалось удалить из друзей. Попробуйте ещё раз.'),
              'danger',
            )
          },
        },
      )
    },
    blockUser: (userId: string) => {
      block.mutate(
        { path: { userId } },
        {
          onError: (error) => {
            toast(failureMessage(error, 'Не удалось заблокировать. Попробуйте ещё раз.'), 'danger')
          },
        },
      )
    },
    unblockUser: (userId: string) => {
      unblock.mutate(
        { path: { userId } },
        {
          onError: (error) => {
            toast(failureMessage(error, 'Не удалось разблокировать. Попробуйте ещё раз.'), 'danger')
          },
        },
      )
    },
    isPending:
      accept.isPending ||
      decline.isPending ||
      remove.isPending ||
      block.isPending ||
      unblock.isPending,
  }
}

/** Sends a request by exact nickname. The answer is neutral on purpose. */
export const useSendFriendRequest = () => useMutation(createFriendRequestMutation())
