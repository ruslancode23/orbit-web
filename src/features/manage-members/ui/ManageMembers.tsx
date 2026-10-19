import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { useSession } from '@/entities/session'
import { atLeast, type WorkspaceRole } from '@/entities/workspace'
import {
  banWorkspaceMemberMutation,
  isApiError,
  listWorkspaceMembersOptions,
  listWorkspaceMembersQueryKey,
  removeWorkspaceMemberMutation,
  setWorkspaceMemberRoleMutation,
} from '@/shared/api'
import { Button } from '@/shared/ui/button'

interface ManageMembersProps {
  workspaceId: string
  role: WorkspaceRole
}

const ROLE_NAME: Record<WorkspaceRole, string> = {
  owner: 'владелец',
  admin: 'админ',
  member: 'участник',
}

/**
 * Members of a server and what may be done to them. Only the owner moves people
 * between roles; an admin may remove and ban those below them. The buttons
 * follow the same rules the server enforces — and the server enforces them again.
 */
export const ManageMembers = ({ workspaceId, role }: ManageMembersProps) => {
  const [open, setOpen] = useState(false)
  const { user } = useSession()
  const queryClient = useQueryClient()
  const { data: members } = useQuery({
    ...listWorkspaceMembersOptions({ path: { workspaceId } }),
    enabled: open,
  })

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: listWorkspaceMembersQueryKey({ path: { workspaceId } }),
    })
  }

  const setRole = useMutation({ ...setWorkspaceMemberRoleMutation(), onSuccess: refresh })
  const remove = useMutation({ ...removeWorkspaceMemberMutation(), onSuccess: refresh })
  const ban = useMutation({ ...banWorkspaceMemberMutation(), onSuccess: refresh })
  const error = setRole.error ?? remove.error ?? ban.error

  if (!open) {
    return (
      <Button
        variant="ghost"
        onClick={() => {
          setOpen(true)
        }}
      >
        Участники
      </Button>
    )
  }

  return (
    <section aria-label="Участники сервера" className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Участники</h3>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {describeError(error)}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {members?.map((member) => {
          const isMe = member.user.id === user?.id
          // Moderation goes downwards only, as on the server.
          const mayModerate = !isMe && atLeast(role, 'admin') && !atLeast(member.role, role)
          return (
            <li key={member.user.id} className="flex flex-col gap-1 text-sm">
              <span className="truncate">
                {member.user.nickname}{' '}
                <span className="text-fg-muted">({ROLE_NAME[member.role]})</span>
              </span>
              <div className="flex flex-wrap gap-1">
                {role === 'owner' && !isMe && member.role !== 'admin' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRole.mutate({
                        path: { workspaceId, userId: member.user.id },
                        body: { role: 'admin' },
                      })
                    }}
                  >
                    Сделать админом
                  </Button>
                )}
                {role === 'owner' && !isMe && member.role === 'admin' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRole.mutate({
                        path: { workspaceId, userId: member.user.id },
                        body: { role: 'member' },
                      })
                    }}
                  >
                    Снять админа
                  </Button>
                )}
                {mayModerate && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        remove.mutate({ path: { workspaceId, userId: member.user.id } })
                      }}
                    >
                      Убрать
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        ban.mutate({ path: { workspaceId, userId: member.user.id }, body: {} })
                      }}
                    >
                      Забанить
                    </Button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <Button
        variant="ghost"
        onClick={() => {
          setOpen(false)
        }}
      >
        Свернуть
      </Button>
    </section>
  )
}

const describeError = (error: unknown): string => {
  if (!isApiError(error)) {
    return 'Не получилось изменить участника.'
  }
  if (error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  if (error.status === 403) {
    return 'Для этого не хватает прав.'
  }
  if (error.status === 400) {
    return 'Сервер всегда должен остаться с владельцем.'
  }
  return 'Не получилось изменить участника.'
}
