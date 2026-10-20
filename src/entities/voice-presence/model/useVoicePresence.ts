import { useQuery } from '@tanstack/react-query'

import { getWorkspaceOptions, type VoicePresence } from '@/shared/api'

/**
 * Who is in the voice channels of one server. The answer comes with the server
 * itself (`GET /workspaces/{id}`); a `voice.presence` event patches the cache,
 * so an entry or exit shows up without a refetch.
 */
export const useVoicePresence = (workspaceId: string | undefined) => {
  return useQuery({
    ...getWorkspaceOptions({ path: { workspaceId: workspaceId ?? '' } }),
    enabled: workspaceId !== undefined,
    select: (membership): VoicePresence[] => membership.voice ?? [],
  })
}
