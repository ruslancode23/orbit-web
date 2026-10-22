import { colorRoleOf, useRoles, useWorkspaceMembers } from '@/entities/workspace'
import { accentOf } from '@/shared/lib/accent'

/**
 * The name colour of each member of the server, from their highest coloured
 * role, as a text class by account id. A dialogue has no server and so no
 * colours; `roles.changed` and `member.changed` repaint them live.
 */
export function useAuthorClasses(workspaceId: string | undefined): Map<string, string> {
  const { data: members } = useWorkspaceMembers(workspaceId)
  const { data: roles } = useRoles(workspaceId)
  const classes = new Map<string, string>()
  for (const member of members ?? []) {
    const text = accentOf(colorRoleOf(member, roles)?.color)?.text
    if (text !== undefined) {
      classes.set(member.user.id, text)
    }
  }
  return classes
}
