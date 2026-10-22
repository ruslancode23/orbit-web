import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  listChannelOverridesOptions,
  listChannelOverridesQueryKey,
  listChannelsQueryKey,
  setChannelOverrideMutation,
  type ChannelOverride,
} from '@/shared/api'

export type { ChannelOverride }

/**
 * What roles may do differently in one channel. Only someone who manages the
 * channel may read it, so the query waits for `enabled`.
 */
export function useChannelOverrides(channelId: string, enabled: boolean) {
  return useQuery({
    ...listChannelOverridesOptions({ path: { channelId } }),
    enabled,
  })
}

/**
 * Sets one role's override; empty allow and deny remove it. The answer is the
 * whole list, so it goes straight to the cache, and the channels are asked
 * again: what the reader may do there could have changed with it.
 */
export function useSetChannelOverride(workspaceId: string, channelId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    ...setChannelOverrideMutation(),
    onSuccess: (overrides) => {
      queryClient.setQueryData(listChannelOverridesQueryKey({ path: { channelId } }), overrides)
      void queryClient.invalidateQueries({
        queryKey: listChannelsQueryKey({ path: { workspaceId } }),
      })
    },
  })
}
