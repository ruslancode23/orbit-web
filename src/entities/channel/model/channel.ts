import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  type Channel,
  createChannelMutation,
  listChannelsOptions,
  listChannelsQueryKey,
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
