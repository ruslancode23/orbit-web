import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createWorkspaceMutation,
  listWorkspacesOptions,
  listWorkspacesQueryKey,
  type WorkspaceMembership,
  type WorkspaceRole,
} from '@/shared/api'

export type { WorkspaceMembership, WorkspaceRole }

/** The servers this account is on, with its role in each. */
export function useWorkspaces() {
  return useQuery(listWorkspacesOptions())
}

/** One of them, by id, out of the list the sidebar already has. */
export function useWorkspace(workspaceId: string | undefined) {
  const { data, isPending } = useWorkspaces()
  const membership = data?.find((item) => item.workspace.id === workspaceId)
  return { membership, isLoading: isPending }
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    ...createWorkspaceMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listWorkspacesQueryKey() })
    },
  })
}

/** Ranks the roles the way the server does, so the UI can ask "at least admin?". */
const RANK: Record<WorkspaceRole, number> = { member: 1, admin: 2, owner: 3 }

export function atLeast(role: WorkspaceRole | undefined, least: WorkspaceRole): boolean {
  if (!role) {
    return false
  }
  return RANK[role] >= RANK[least]
}
