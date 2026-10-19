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
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

import { describeInviteExpiry, describeInviteUses, formatInviteDate } from '../lib/invites'

interface ManageInvitesProps {
  workspaceId: string
  /** Members may create links only when the server's own `canInvite` is on. */
  canInvite: boolean
  /** Admins and the owner also see and revoke every link. */
  canManage: boolean
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
export const ManageInvites = ({ workspaceId, canInvite, canManage }: ManageInvitesProps) => {
  const [open, setOpen] = useState(false)
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

  if (!open) {
    return (
      <Button
        variant="ghost"
        onClick={() => {
          setOpen(true)
        }}
      >
        Пригласить
      </Button>
    )
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
    <section
      aria-label="Приглашение на сервер"
      className="flex flex-col gap-2 rounded-md bg-surface p-2"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Приглашение</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false)
          }}
        >
          Закрыть
        </Button>
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
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          {LIFETIMES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <Button
        size="sm"
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
        <div className="flex flex-col gap-1 border-t border-border pt-2">
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
        <div className="flex flex-col gap-1 border-t border-border pt-2">
          <h4 className="text-xs font-semibold text-fg-muted">Все ссылки</h4>
          {invites.isPending ? (
            <p role="status" className="text-xs text-fg-muted">
              Загружаем…
            </p>
          ) : invites.data?.filter((invite) => !revoked.includes(invite.id)).length ? (
            <ul className="flex flex-col gap-2">
              {invites.data
                .filter((invite) => !revoked.includes(invite.id))
                .map((invite) => (
                  <li key={invite.id} className="flex flex-col gap-0.5 text-xs">
                    <span>{describeInviteUses(invite)}</span>
                    <span className="text-fg-muted">
                      {describeInviteExpiry(invite)} · создана {formatInviteDate(invite.createdAt)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
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
    </section>
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
