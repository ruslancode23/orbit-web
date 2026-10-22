import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createWorkspaceMutation,
  deleteWorkspaceIconMutation,
  deleteWorkspaceMutation,
  getWorkspaceQueryKey,
  listWorkspacesOptions,
  listWorkspacesQueryKey,
  updateWorkspaceMutation,
  uploadWorkspaceIconMutation,
  type Workspace,
  type WorkspaceMembership,
  type Permission,
  type WorkspacePermissions,
  type WorkspaceRole,
} from '@/shared/api'

export type { Workspace, WorkspaceMembership, WorkspacePermissions, WorkspaceRole }

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

/**
 * Every change to a server comes back as the server itself; the list is read
 * again rather than patched, so the short-lived icon link is always fresh.
 */
function useRefreshWorkspaces() {
  const queryClient = useQueryClient()
  return async (workspaceId?: string) => {
    await queryClient.invalidateQueries({ queryKey: listWorkspacesQueryKey() })
    if (workspaceId) {
      await queryClient.invalidateQueries({
        queryKey: getWorkspaceQueryKey({ path: { workspaceId } }),
      })
    }
  }
}

export function useCreateWorkspace() {
  const refresh = useRefreshWorkspaces()
  return useMutation({
    ...createWorkspaceMutation(),
    onSuccess: async () => {
      await refresh()
    },
  })
}

/** Name, description and member permissions: only what is sent changes. */
export function useUpdateWorkspace() {
  const refresh = useRefreshWorkspaces()
  return useMutation({
    ...updateWorkspaceMutation(),
    onSuccess: async (_data, variables) => {
      await refresh(variables.path.workspaceId)
    },
  })
}

export function useUploadWorkspaceIcon() {
  const refresh = useRefreshWorkspaces()
  return useMutation({
    ...uploadWorkspaceIconMutation(),
    onSuccess: async (_data, variables) => {
      await refresh(variables.path.workspaceId)
    },
  })
}

export function useDeleteWorkspaceIcon() {
  const refresh = useRefreshWorkspaces()
  return useMutation({
    ...deleteWorkspaceIconMutation(),
    onSuccess: async (_data, variables) => {
      await refresh(variables.path.workspaceId)
    },
  })
}

/** Deletes the server with everything in it. Owner only. */
export function useDeleteWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    ...deleteWorkspaceMutation(),
    onSuccess: async (_data, variables) => {
      const path = { workspaceId: variables.path.workspaceId }
      // Nothing under it can be read any more: drop it instead of refetching 404s.
      queryClient.removeQueries({
        predicate: (query) => isAbout(query.queryKey, path.workspaceId),
      })
      await queryClient.invalidateQueries({ queryKey: listWorkspacesQueryKey() })
    },
  })
}

/** Whether a generated query key reads something under this server. */
function isAbout(queryKey: readonly unknown[], workspaceId: string): boolean {
  const head = queryKey[0]
  if (typeof head !== 'object' || head === null || !('path' in head)) {
    return false
  }
  const { path } = head
  return (
    typeof path === 'object' &&
    path !== null &&
    'workspaceId' in path &&
    path.workspaceId === workspaceId
  )
}

/** Ranks the roles the way the server does, so the UI can ask "at least admin?". */
const RANK: Record<WorkspaceRole, number> = { member: 1, admin: 2, owner: 3 }

export type { Permission }

export function atLeast(role: WorkspaceRole | undefined, least: WorkspaceRole): boolean {
  if (!role) {
    return false
  }
  return RANK[role] >= RANK[least]
}

/** What a member may be allowed to do on a server (`memberPermissions`). */
export type MemberPermission = keyof WorkspacePermissions

/**
 * Whether this account holds a permission on the server, before any channel:
 * the server sends what @everyone and the account's roles add up to. A
 * convenience for drawing buttons — the server checks again on every request.
 * A server that does not send permissions yet is read the old way: the owner
 * and admins may do everything.
 */
export function hasPermission(
  membership: WorkspaceMembership | undefined,
  permission: Permission,
): boolean {
  if (!membership) {
    return false
  }
  if (membership.permissions) {
    return (
      membership.permissions.includes(permission) ||
      membership.permissions.includes('administrator')
    )
  }
  return atLeast(membership.role, 'admin')
}

/** The permissions behind the old member flags; creating channels is also managing them. */
const FLAG_PERMISSIONS: Record<MemberPermission, readonly Permission[]> = {
  canInvite: ['createInvite'],
  canCreateChannels: ['createChannels', 'manageChannels'],
  canAttachFiles: ['attachFiles'],
}

/**
 * Whether this account may do what one of the old member flags speaks about:
 * any of the permissions behind it. Without permissions from the server, the
 * owner and admins always may and a member when the server allows it.
 */
export function can(membership: WorkspaceMembership | undefined, permission: MemberPermission) {
  if (!membership) {
    return false
  }
  if (membership.permissions) {
    return FLAG_PERMISSIONS[permission].some((needed) => hasPermission(membership, needed))
  }
  if (atLeast(membership.role, 'admin')) {
    return true
  }
  return membership.workspace.memberPermissions[permission]
}
