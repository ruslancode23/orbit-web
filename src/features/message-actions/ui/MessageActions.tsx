import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { useSession } from '@/entities/session'
import { deleteMessageMutation, type Message } from '@/shared/api'
import { Button } from '@/shared/ui/button'

import { describeActionError } from '../model/describe-error'
import { replaceMessageInHistory } from '../model/message-cache'

interface MessageActionsProps {
  message: Message
  /** Replying is writing; a read-only channel offers no reply. */
  canWrite: boolean
  onReply: () => void
  onEdit: () => void
}

/**
 * What may be done with one message: answer it, rewrite or delete one's own.
 * The buttons follow the rules the server enforces — the server checks them
 * again, so hiding an action is a convenience, never the protection.
 */
export const MessageActions = ({ message, canWrite, onReply, onEdit }: MessageActionsProps) => {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const confirmRef = useRef<HTMLButtonElement | null>(null)

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

  if (message.deletedAt !== undefined) {
    return null
  }

  const own = message.author !== undefined && message.author.id === user?.id
  const nothingToShow = !canWrite && !own
  if (nothingToShow) {
    return null
  }

  return (
    <div className="mt-1 flex min-h-7 flex-wrap items-center gap-1 opacity-100 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 sm:opacity-0">
      {canWrite && (
        <Button size="sm" variant="ghost" onClick={onReply}>
          Ответить
        </Button>
      )}
      {own && (
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Изменить
        </Button>
      )}
      {own && !confirming && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setConfirming(true)
          }}
        >
          Удалить
        </Button>
      )}
      {own && confirming && (
        <div role="group" aria-label="Подтверждение удаления" className="flex items-center gap-1">
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
      {remove.error && (
        <p role="alert" className="text-xs text-danger">
          {describeActionError(remove.error, 'Не получилось удалить сообщение.')}
        </p>
      )}
    </div>
  )
}
