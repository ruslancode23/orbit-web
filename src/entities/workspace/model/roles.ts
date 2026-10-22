import { useQuery } from '@tanstack/react-query'

import { listRolesOptions, type Role, type WorkspaceMember } from '@/shared/api'

export type { Role }

/**
 * The roles of a server, highest first and @everyone last. Every member reads
 * them: colours and groups are drawn for everyone. `roles.changed` refreshes
 * them live.
 */
export function useRoles(workspaceId: string | undefined) {
  return useQuery({
    ...listRolesOptions({ path: { workspaceId: workspaceId ?? '' } }),
    enabled: workspaceId !== undefined,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Where a member stands among the roles: the position of their highest role,
 * 0 with none but @everyone, and above every role for the owner — the same
 * ranking the server uses for «who may act on whom».
 */
export function rankOf(member: WorkspaceMember | undefined, roles: readonly Role[] | undefined) {
  if (!member) {
    return -1
  }
  if (member.role === 'owner') {
    return Number.POSITIVE_INFINITY
  }
  let top = 0
  for (const role of roles ?? []) {
    if (!role.isDefault && member.roleIds?.includes(role.id) && role.position > top) {
      top = role.position
    }
  }
  return top
}

/** Whether `me` may act on `target`: strictly higher, and never on the owner. */
export function outranks(
  me: WorkspaceMember | undefined,
  target: WorkspaceMember,
  roles: readonly Role[] | undefined,
): boolean {
  if (target.role === 'owner') {
    return false
  }
  return rankOf(me, roles) > rankOf(target, roles)
}

/**
 * The highest role a member holds that is shown apart: their group in the
 * member column. Undefined puts them with everyone else.
 */
export function groupRoleOf(
  member: WorkspaceMember,
  roles: readonly Role[] | undefined,
): Role | undefined {
  // Roles come highest first, so the first match is the highest.
  return (roles ?? []).find(
    (role) => !role.isDefault && role.hoist && member.roleIds?.includes(role.id),
  )
}

/** The highest role a member holds that has a colour: the colour of their name. */
export function colorRoleOf(
  member: WorkspaceMember,
  roles: readonly Role[] | undefined,
): Role | undefined {
  return (roles ?? []).find(
    (role) => !role.isDefault && role.color !== undefined && member.roleIds?.includes(role.id),
  )
}
