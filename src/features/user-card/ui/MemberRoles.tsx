import { useState } from 'react'

import { useSession } from '@/entities/session'
import {
  describeRoleError,
  hasPermission,
  rankOf,
  useMemberRoles,
  useRoles,
  useWorkspace,
  useWorkspaceMembers,
  type WorkspaceMember,
} from '@/entities/workspace'
import { accentOf } from '@/shared/lib/accent'
import { cn } from '@/shared/lib/cn'
import { Switch } from '@/shared/ui/switch'

interface MemberRolesProps {
  workspaceId: string
  member: WorkspaceMember
}

/**
 * The roles of one member and switches to give or take them. Shown to someone
 * who may manage roles; a role at or above their own, or a member not below
 * them, is shown but locked — the server refuses those anyway.
 */
export const MemberRoles = ({ workspaceId, member }: MemberRolesProps) => {
  const { user } = useSession()
  const myId = user?.id
  const { membership } = useWorkspace(workspaceId)
  const { data: roles } = useRoles(workspaceId)
  const { data: members } = useWorkspaceMembers(workspaceId)
  const { grant, revoke } = useMemberRoles(workspaceId)
  const [error, setError] = useState<string | null>(null)

  const me = members?.find((item) => item.user.id === myId)
  const myRank = rankOf(me, roles)
  const ownRoles = member.user.id === myId
  const mayActOnMember = ownRoles || rankOf(member, roles) < myRank
  if (!hasPermission(membership, 'manageRoles')) {
    return null
  }
  const assignable = (roles ?? []).filter((role) => !role.isDefault)
  if (assignable.length === 0) {
    return null
  }

  const toggle = (roleId: string, give: boolean) => {
    setError(null)
    const variables = { path: { workspaceId, userId: member.user.id, roleId } }
    const options = {
      onError: (failure: unknown) => {
        setError(describeRoleError(failure))
      },
    }
    if (give) {
      grant.mutate(variables, options)
    } else {
      revoke.mutate(variables, options)
    }
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Роли</legend>
      {assignable.map((role) => {
        const held = member.roleIds?.includes(role.id) ?? false
        const locked =
          !mayActOnMember || role.position >= myRank || grant.isPending || revoke.isPending
        return (
          <div key={role.id} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className={cn(
                  'size-2.5 shrink-0 rounded-full',
                  accentOf(role.color)?.swatch ?? 'bg-border',
                )}
              />
              <span className="truncate">{role.name}</span>
            </span>
            <Switch
              aria-label={`Роль ${role.name}`}
              checked={held}
              disabled={locked}
              onCheckedChange={(checked) => {
                toggle(role.id, checked)
              }}
            />
          </div>
        )
      })}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </fieldset>
  )
}
