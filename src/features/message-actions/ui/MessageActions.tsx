import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { useSession } from '@/entities/session'
import { deleteMessageMutation, type Message } from '@/shared/api'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import { EditIcon, ReplyIcon, SmileIcon, TrashIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'

import { describeActionError } from '../model/describe-error'
import { replaceMessageInHistory } from '../model/message-cache'
import { REACTION_EMOJI, useReactionActions } from '../model/reactions'

interface MessageActionsProps {
  message: Message
  /** Replying is writing; a read-only channel offers no reply. */
  canWrite: boolean
  onReply: () => void
  onEdit: () => void
}

/**
 * What may be done with one message, as pictures in a panel that shows on hover
 * or when the keyboard reaches the row: react, answer, rewrite or delete one's
 * own. The buttons follow the rules the server enforces — the server checks
 * them again, so hiding an action is a convenience, never the protection.
 */
export const MessageActions = ({ message, canWrite, onReply, onEdit }: MessageActionsProps) => {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const [picking, setPicking] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const confirmRef = useRef<HTMLButtonElement | null>(null)
  const reactions = useReactionActions(message)

  const remove = useMutation({
    ...deleteMessageMutation(),
    onSuccess: (updated) => {
      replaceMessageInHistory(queryClient, message.channelId, updated)
    },
  })

  useEffect(() => {
    if (confirming) {
      confirmRef.current?.focus()
    }
  }, [confirming])

  // A system line is not somebody's text: there is nothing to react to, reply
  // to, edit or delete on it.
  if (message.kind === 'system' || message.deletedAt !== undefined) {
    return null
  }

  const own = message.author !== undefined && message.author.id === user?.id
  const nothingToShow = !canWrite && !own
  if (nothingToShow) {
    return null
  }

  const panelOpen = picking || confirming
  const error = reactions.error ?? remove.error

  return (
    <div className="flex flex-col items-end gap-1">
      <div
        role="group"
        aria-label="Действия с сообщением"
        className={cn(
          'flex items-center gap-0.5 rounded-md border border-border bg-surface-raised p-0.5 shadow-popover transition-opacity',
          panelOpen
            ? 'opacity-100'
            : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
        )}
      >
        {canWrite && (
          <IconButton
            label="Добавить реакцию"
            size="sm"
            pressed={picking}
            aria-expanded={picking}
            onClick={() => {
              setPicking((current) => !current)
              setConfirming(false)
            }}
          >
            <SmileIcon />
          </IconButton>
        )}
        {canWrite && (
          <IconButton label="Ответить" size="sm" onClick={onReply}>
            <ReplyIcon />
          </IconButton>
        )}
        {own && (
          <IconButton label="Изменить" size="sm" onClick={onEdit}>
            <EditIcon />
          </IconButton>
        )}
        {own && (
          <IconButton
            label="Удалить"
            size="sm"
            variant="danger"
            onClick={() => {
              setConfirming(true)
              setPicking(false)
            }}
          >
            <TrashIcon />
          </IconButton>
        )}
      </div>

      {picking && (
        <div
          role="group"
          aria-label="Выберите реакцию"
          className="flex flex-wrap justify-end gap-1 rounded-md border border-border bg-surface-raised p-1 shadow-popover"
        >
          {REACTION_EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`Поставить реакцию ${emoji}`}
              disabled={reactions.pending}
              className="rounded-md px-2 py-1 text-base hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50"
              onClick={() => {
                setPicking(false)
                reactions.react(emoji)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {confirming && (
        <div
          role="group"
          aria-label="Подтверждение удаления"
          className="flex items-center gap-1 rounded-md border border-border bg-surface-raised p-1 shadow-popover"
        >
          <span className="text-xs text-fg-muted">Удалить сообщение?</span>
          <Button
            size="sm"
            variant="danger"
            ref={confirmRef}
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate({ path: { messageId: message.id } })
            }}
          >
            Удалить
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setConfirming(false)
            }}
          >
            Отмена
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-danger">
          {describeActionError(error, 'Не получилось выполнить действие.')}
        </p>
      )}
    </div>
  )
}
