import { userDisplayName } from '@/entities/user'
import { groupRoleOf, type Role, type WorkspaceMember } from '@/entities/workspace'

/** The members shown under one heading: a role shown apart, or everyone else. */
export interface MemberGroup {
  key: string
  title: string
  rows: WorkspaceMember[]
}

/**
 * Members grouped as Discord does: each under the highest role they hold that
 * is shown apart, those roles highest first, and the rest as «Участники».
 */
export const groupMembers = (
  members: readonly WorkspaceMember[],
  roles: readonly Role[] | undefined,
): MemberGroup[] => {
  const byName = (a: WorkspaceMember, b: WorkspaceMember) =>
    userDisplayName(a.user).localeCompare(userDisplayName(b.user), 'ru')
  const groups = new Map<string, WorkspaceMember[]>()
  const rest: WorkspaceMember[] = []
  for (const member of members) {
    const role = groupRoleOf(member, roles)
    if (role) {
      groups.set(role.id, [...(groups.get(role.id) ?? []), member])
    } else {
      rest.push(member)
    }
  }
  const result: MemberGroup[] = []
  for (const role of roles ?? []) {
    const rows = groups.get(role.id)
    if (rows) {
      result.push({ key: role.id, title: role.name, rows: rows.sort(byName) })
    }
  }
  if (rest.length > 0) {
    result.push({ key: 'rest', title: 'Участники', rows: rest.sort(byName) })
  }
  return result
}
