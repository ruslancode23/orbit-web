import { useSession } from '@/entities/session'
import {
  describeMemberActionError,
  mayBan,
  mayChangeRole,
  mayKick,
  useMemberModeration,
  useRoles,
  useWorkspace,
  useWorkspaceMembers,
  type WorkspaceMember,
} from '@/entities/workspace'
import { Button } from '@/shared/ui/button'

/**
 * What an owner or an admin may do to this person on the current server. The
 * rules and the calls are the same ones the members dialog uses; the server
 * checks them again on every action.
 */
export const ModerationActions = ({
  workspaceId,
  member,
}: {
  workspaceId: string
  member: WorkspaceMember
}) => {
  const { user } = useSession()
  const { membership } = useWorkspace(workspaceId)
  const moderation = useMemberModeration(workspaceId)
  const { data: members } = useWorkspaceMembers(workspaceId)
  const { data: roles } = useRoles(workspaceId)
  const standing = {
    membership,
    me: members?.find((item) => item.user.id === user?.id),
    roles,
  }
  const canChangeRole = mayChangeRole(membership?.role, member, user?.id)
  const canKick = mayKick(standing, member)
  const canBan = mayBan(standing, member)

  if (!canChangeRole && !canKick && !canBan) {
    return null
  }

  return (
    <div className="flex flex-col gap-1 border-t border-border pt-2">
      <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Модерация</p>
      <div className="flex flex-wrap gap-1">
        {canChangeRole && member.role !== 'admin' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              moderation.setRole.mutate({
                path: { workspaceId, userId: member.user.id },
                body: { role: 'admin' },
              })
            }}
          >
            Сделать админом
          </Button>
        )}
        {canChangeRole && member.role === 'admin' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              moderation.setRole.mutate({
                path: { workspaceId, userId: member.user.id },
                body: { role: 'member' },
              })
            }}
          >
            Снять админа
          </Button>
        )}
        {canKick && (
          <Button
            size="sm"
            variant="ghost"
            disabled={moderation.pending}
            onClick={() => {
              moderation.remove.mutate({
                path: { workspaceId, userId: member.user.id },
              })
            }}
          >
            Убрать
          </Button>
        )}
        {canBan && (
          <Button
            size="sm"
            variant="danger"
            disabled={moderation.pending}
            onClick={() => {
              moderation.ban.mutate({
                path: { workspaceId, userId: member.user.id },
                body: {},
              })
            }}
          >
            Забанить
          </Button>
        )}
      </div>
      {moderation.error && (
        <p role="alert" className="text-xs text-danger">
          {describeMemberActionError(moderation.error)}
        </p>
      )}
    </div>
  )
}
