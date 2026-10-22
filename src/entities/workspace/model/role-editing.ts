import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  createRoleMutation,
  deleteRoleMutation,
  getWorkspaceQueryKey,
  grantRoleMutation,
  listRolesQueryKey,
  listWorkspaceMembersQueryKey,
  listWorkspacesQueryKey,
  reorderRolesMutation,
  revokeRoleMutation,
  updateRoleMutation,
} from '@/shared/api'

import type { QueryClient } from '@tanstack/react-query'

/**
 * A role change moves what people may do: the roles themselves, the members
 * (their roles and rank) and this account's own permissions are read again.
 * The live roles.changed event does the same for everyone else.
 */
const refresh = async (queryClient: QueryClient, workspaceId: string) => {
  const path = { workspaceId }
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: listRolesQueryKey({ path }) }),
    queryClient.invalidateQueries({ queryKey: listWorkspaceMembersQueryKey({ path }) }),
    queryClient.invalidateQueries({ queryKey: getWorkspaceQueryKey({ path }) }),
    queryClient.invalidateQueries({ queryKey: listWorkspacesQueryKey() }),
  ])
}

/** Creating, editing, ordering and deleting the roles of one server. */
export function useRoleEditing(workspaceId: string) {
  const queryClient = useQueryClient()
  const onSuccess = () => refresh(queryClient, workspaceId)
  return {
    create: useMutation({ ...createRoleMutation(), onSuccess }),
    update: useMutation({ ...updateRoleMutation(), onSuccess }),
    remove: useMutation({ ...deleteRoleMutation(), onSuccess }),
    reorder: useMutation({ ...reorderRolesMutation(), onSuccess }),
  }
}

/** Giving and taking the roles of one member. */
export function useMemberRoles(workspaceId: string) {
  const queryClient = useQueryClient()
  const onSuccess = () => refresh(queryClient, workspaceId)
  return {
    grant: useMutation({ ...grantRoleMutation(), onSuccess }),
    revoke: useMutation({ ...revokeRoleMutation(), onSuccess }),
  }
}
