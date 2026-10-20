import { useQuery } from '@tanstack/react-query'

import { useSession } from '@/entities/session'
import type { WorkspaceRole } from '@/entities/workspace'
import { listWorkspaceMembersOptions } from '@/shared/api'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'
import { XIcon } from '@/shared/ui/icon'
import { Skeleton } from '@/shared/ui/skeleton'

import {
  describeMemberActionError,
  mayModerate,
  ROLE_NAME,
  useMemberModeration,
} from '../model/moderation'

interface ManageMembersProps {
  workspaceId: string
  role: WorkspaceRole
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Members of a server and what may be done to them. Only the owner moves people
 * between roles; an admin may remove and ban those below them. The buttons
 * follow the same rules the server enforces — and the server enforces them again.
 */
export const ManageMembers = ({ workspaceId, role, open, onOpenChange }: ManageMembersProps) => {
  const { user } = useSession()
  const { data: members, isPending } = useQuery({
    ...listWorkspaceMembersOptions({ path: { workspaceId } }),
    enabled: open,
  })
  const moderation = useMemberModeration(workspaceId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle>Участники и баны</DialogTitle>
            <DialogDescription>Кто есть на сервере и что можно с ними сделать.</DialogDescription>
          </div>
          <DialogClose asChild>
            <button
              type="button"
              aria-label="Закрыть"
              title="Закрыть"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <XIcon />
            </button>
          </DialogClose>
        </div>

        {moderation.error && (
          <p role="alert" className="text-sm text-danger">
            {describeMemberActionError(moderation.error)}
          </p>
        )}

        <div aria-label="Участники сервера" role="group" className="min-h-0 overflow-y-auto">
          {isPending ? (
            <div role="status" aria-label="Загружаем участников" className="flex flex-col gap-3">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-2">
                  <Skeleton className="size-6 shrink-0 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {members?.map((member) => {
                const isMe = member.user.id === user?.id
                const moderates = mayModerate(role, member, user?.id)
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
                            moderation.setRole.mutate({
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
                            moderation.setRole.mutate({
                              path: { workspaceId, userId: member.user.id },
                              body: { role: 'member' },
                            })
                          }}
                        >
                          Снять админа
                        </Button>
                      )}
                      {moderates && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              moderation.remove.mutate({
                                path: { workspaceId, userId: member.user.id },
                              })
                            }}
                          >
                            Убрать
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              moderation.ban.mutate({
                                path: { workspaceId, userId: member.user.id },
                                body: {},
                              })
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
