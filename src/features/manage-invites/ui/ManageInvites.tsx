import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'

import {
  createInviteMutation,
  isApiError,
  listInvitesOptions,
  listInvitesQueryKey,
  revokeInviteMutation,
  type Invite,
} from '@/shared/api'
import { inviteUrl } from '@/shared/lib/invite-link'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'
import { XIcon } from '@/shared/ui/icon'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Skeleton } from '@/shared/ui/skeleton'

import { describeInviteExpiry, describeInviteUses, formatInviteDate } from '../lib/invites'

interface ManageInvitesProps {
  workspaceId: string
  /** Members may create links only when the server's own `canInvite` is on. */
  canInvite: boolean
  /** Admins and the owner also see and revoke every link. */
  canManage: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

const LIFETIMES = [
  { value: '24', label: '1 день' },
  { value: '168', label: '7 дней' },
  { value: '720', label: '30 дней' },
  { value: '', label: 'Бессрочно' },
] as const

/**
 * Invite links of one server. The link is made here and pasted wherever the
 * people are; a guest follows it and needs only a name. A member may create a
 * link when the server allows it; listing and revoking stay with admins, as on
 * the server — the buttons here just follow the same rule.
 */
export const ManageInvites = ({
  workspaceId,
  canInvite,
  canManage,
  open,
  onOpenChange,
}: ManageInvitesProps) => {
  const [lifetime, setLifetime] = useState<string>('168')
  const [created, setCreated] = useState<Invite | undefined>(undefined)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  // The API lists revoked links too and cannot tell them apart: keep the ones
  // this session revoked out of the list itself.
  const [revoked, setRevoked] = useState<string[]>([])
  const lifetimeId = useId()
  const linkId = useId()
  const queryClient = useQueryClient()

  const invites = useQuery({
    ...listInvitesOptions({ path: { workspaceId } }),
    enabled: open && canManage,
  })

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: listInvitesQueryKey({ path: { workspaceId } }),
    })
  }

  const create = useMutation({
    ...createInviteMutation(),
    onSuccess: async (invite) => {
      setCreated(invite)
      setCopyState('idle')
      await refresh()
    },
  })

  const revoke = useMutation({
    ...revokeInviteMutation(),
    onSuccess: async (_data, variables) => {
      setRevoked((current) => [...current, variables.path.inviteId])
      if (created?.id === variables.path.inviteId) {
        setCreated(undefined)
      }
      await refresh()
    },
  })

  if (!canInvite) {
    return null
  }

  const copy = async () => {
    if (!created) {
      return
    }
    try {
      await navigator.clipboard.writeText(inviteUrl(created.code))
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  const error = create.error ?? revoke.error

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle>Приглашение</DialogTitle>
            <DialogDescription>
              Ссылка живёт, пока вы её не отзовёте или не истечёт срок.
            </DialogDescription>
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

        <div className="flex flex-col gap-1">
          <Label htmlFor={lifetimeId} className="text-xs text-fg-muted">
            Срок действия
          </Label>
          <select
            id={lifetimeId}
            value={lifetime}
            onChange={(event) => {
              setLifetime(event.target.value)
            }}
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {LIFETIMES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <Button
          disabled={create.isPending}
          onClick={() => {
            create.mutate({
              path: { workspaceId },
              body: lifetime === '' ? {} : { expiresInHours: Number(lifetime) },
            })
          }}
        >
          {create.isPending ? 'Создаём…' : 'Создать ссылку'}
        </Button>

        {error && (
          <p role="alert" className="text-xs text-danger">
            {describeError(error)}
          </p>
        )}

        {created && (
          <div className="flex flex-col gap-1 border-t border-border pt-3">
            <Label htmlFor={linkId} className="text-xs text-fg-muted">
              Ссылка-приглашение
            </Label>
            <Input
              id={linkId}
              readOnly
              value={inviteUrl(created.code)}
              onFocus={(event) => {
                event.currentTarget.select()
              }}
              className="text-xs"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void copy()
                }}
              >
                Копировать
              </Button>
              {copyState === 'copied' && (
                <p role="status" className="text-xs text-success">
                  Ссылка скопирована
                </p>
              )}
              {copyState === 'failed' && (
                <p role="status" className="text-xs text-fg-muted">
                  Скопируйте ссылку вручную
                </p>
              )}
            </div>
            <p className="text-xs text-fg-muted">{describeInviteExpiry(created)}</p>
          </div>
        )}

        {canManage && (
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto border-t border-border pt-3">
            <h4 className="text-xs font-semibold text-fg-muted">Все ссылки</h4>
            {invites.isPending ? (
              <div role="status" aria-label="Загружаем ссылки" className="flex flex-col gap-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-44" />
                <Skeleton className="h-3 w-24" />
              </div>
            ) : invites.data?.filter((invite) => !revoked.includes(invite.id)).length ? (
              <ul className="flex flex-col gap-2">
                {invites.data
                  .filter((invite) => !revoked.includes(invite.id))
                  .map((invite) => (
                    <li key={invite.id} className="flex flex-col gap-0.5 text-xs">
                      <span>{describeInviteUses(invite)}</span>
                      <span className="text-fg-muted">
                        {describeInviteExpiry(invite)} · создана{' '}
                        {formatInviteDate(invite.createdAt)}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="self-start"
                        aria-label={`Отозвать приглашение от ${formatInviteDate(invite.createdAt)}`}
                        disabled={revoke.isPending}
                        onClick={() => {
                          revoke.mutate({ path: { inviteId: invite.id } })
                        }}
                      >
                        Отозвать
                      </Button>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-xs text-fg-muted">Ссылок пока нет.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

const describeError = (error: unknown): string => {
  if (!isApiError(error)) {
    return 'Не получилось. Попробуйте ещё раз.'
  }
  if (error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  if (error.status === 403) {
    return 'Недостаточно прав для приглашений.'
  }
  if (error.status === 404) {
    return 'Этой ссылки уже нет.'
  }
  return 'Не получилось. Попробуйте ещё раз.'
}
