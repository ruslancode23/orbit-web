import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { useSession } from '@/entities/session'
import { deleteMessageMutation, type Message } from '@/shared/api'
import { copyText } from '@/shared/lib/clipboard'
import { Button } from '@/shared/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { CopyIcon, EditIcon, ReplyIcon, SmileIcon, TrashIcon } from '@/shared/ui/icon'
import { useToast } from '@/shared/ui/toast'

import { describeActionError } from '../model/describe-error'
import { replaceMessageInHistory } from '../model/message-cache'
import { REACTION_EMOJI, useReactionActions } from '../model/reactions'

import type { ReactNode } from 'react'

interface MessageContextMenuProps {
  message: Message
  canWrite: boolean
  /** manageMessages in this channel: deleting somebody else's message too. */
  canModerate?: boolean
  /** While the message is being rewritten, the right click belongs to the field. */
  disabled?: boolean
  onReply: () => void
  onEdit: () => void
  children: ReactNode
}

/**
 * The same actions as the hover panel of `MessageActions`, behind a right
 * click or a long press, plus copying the text. The panel stays: it is the way
 * a keyboard reaches these actions.
 */
export const MessageContextMenu = ({
  message,
  canWrite,
  canModerate = false,
  disabled = false,
  onReply,
  onEdit,
  children,
}: MessageContextMenuProps) => {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const reactions = useReactionActions(message)
  const reactionError = reactions.error

  // The menu is gone by the time the server answers: a refusal goes to a toast.
  useEffect(() => {
    if (reactionError) {
      toast(describeActionError(reactionError, 'Не получилось поставить реакцию.'), 'danger')
    }
  }, [reactionError, toast])

  const remove = useMutation({
    ...deleteMessageMutation(),
    onSuccess: (updated) => {
      replaceMessageInHistory(queryClient, message.channelId, updated)
      setConfirming(false)
    },
  })

  if (disabled || message.kind === 'system' || message.deletedAt !== undefined) {
    return children
  }

  const own = message.author !== undefined && message.author.id === user?.id
  const canDelete = own || canModerate
  const hasText = message.content !== ''

  const handleCopy = async () => {
    const done = await copyText(message.content)
    toast(done ? 'Текст скопирован' : 'Не удалось скопировать текст.', done ? 'success' : 'danger')
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>{children}</div>
        </ContextMenuTrigger>
        <ContextMenuContent aria-label="Действия с сообщением">
          {canWrite && (
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <SmileIcon className="size-4 text-fg-muted" />
                Реакция
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="flex gap-0.5">
                {REACTION_EMOJI.map((emoji) => (
                  <ContextMenuItem
                    key={emoji}
                    aria-label={`Поставить реакцию ${emoji}`}
                    disabled={reactions.pending}
                    className="px-1.5 text-base"
                    onSelect={() => {
                      reactions.react(emoji)
                    }}
                  >
                    {emoji}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}
          {canWrite && (
            <ContextMenuItem onSelect={onReply}>
              <ReplyIcon className="size-4 text-fg-muted" />
              Ответить
            </ContextMenuItem>
          )}
          {own && (
            <ContextMenuItem onSelect={onEdit}>
              <EditIcon className="size-4 text-fg-muted" />
              Изменить
            </ContextMenuItem>
          )}
          {hasText && (
            <ContextMenuItem onSelect={() => void handleCopy()}>
              <CopyIcon className="size-4 text-fg-muted" />
              Копировать текст
            </ContextMenuItem>
          )}
          {canDelete && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                danger
                onSelect={() => {
                  remove.reset()
                  setConfirming(true)
                }}
              >
                <TrashIcon className="size-4" />
                Удалить сообщение
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogTitle>Удалить сообщение?</DialogTitle>
          <DialogDescription>Его увидят как удалённое, вернуть его нельзя.</DialogDescription>
          {remove.error && (
            <p role="alert" className="text-sm text-danger">
              {describeActionError(remove.error, 'Не получилось удалить сообщение.')}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setConfirming(false)
              }}
            >
              Отмена
            </Button>
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() => {
                remove.mutate({ path: { messageId: message.id } })
              }}
            >
              Удалить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
