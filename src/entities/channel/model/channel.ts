import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type Channel,
  createChannelMutation,
  deleteChannelMutation,
  listChannelsOptions,
  listChannelsQueryKey,
  updateChannelMutation,
} from '@/shared/api'

export type { Channel }

/** The channels of one server, in the order its admins put them. */
export function useChannels(workspaceId: string | undefined) {
  return useQuery({
    ...listChannelsOptions({ path: { workspaceId: workspaceId ?? '' } }),
    enabled: workspaceId !== undefined,
  })
}

export function useCreateChannel(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    ...createChannelMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: listChannelsQueryKey({ path: { workspaceId } }),
      })
    },
  })
}

/** Rename a channel, change its topic or make it read-only; admins and the owner only. */
export function useUpdateChannel(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    ...updateChannelMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: listChannelsQueryKey({ path: { workspaceId } }),
      })
    },
  })
}

/** Delete a channel with its messages; admins and the owner only. */
export function useDeleteChannel(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    ...deleteChannelMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: listChannelsQueryKey({ path: { workspaceId } }),
      })
    },
  })
}

/**
 * Whether the reader may do something in one channel, overrides applied. A
 * channel may allow what the server does not, and the other way round; a
 * server that sends no channel permissions falls back to `fallback`.
 */
export function channelAllows(
  channel: Channel | undefined,
  permission: NonNullable<Channel['permissions']>[number],
  fallback: boolean,
): boolean {
  if (!channel?.permissions) {
    return fallback
  }
  return channel.permissions.includes(permission) || channel.permissions.includes('administrator')
}
