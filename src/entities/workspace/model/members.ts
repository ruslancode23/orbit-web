import { useQuery } from '@tanstack/react-query'

import { listWorkspaceMembersOptions, type WorkspaceMember } from '@/shared/api'

export type { WorkspaceMember }

/**
 * Everyone on the server: the member list is what the mention hints are made
 * of. It changes rarely, so it is kept for a while and refreshed by the live
 * `member.changed` event, which drops every cached query.
 */
export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    ...listWorkspaceMembersOptions({ path: { workspaceId: workspaceId ?? '' } }),
    enabled: workspaceId !== undefined,
    staleTime: 5 * 60 * 1000,
  })
}
