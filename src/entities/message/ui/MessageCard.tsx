import { cn } from '@/shared/lib/cn'

import { MessageText } from './MessageText'
import { authorName, formatTime, messagePreview, type Message } from '../model/message'

import type { ReactNode } from 'react'

interface MessageCardProps {
  message: Message
  /** False for a message that continues the block above it. */
  startsGroup: boolean
  /** Highlights a message that names the person reading it. */
  mentionsMe?: boolean
  /** The reader's nickname, marked inside the text when the message mentions them. */
  myNickname?: string
  /** The message this one answers, when it is still in the loaded history. */
  replyTo?: Message
  /** Scrolls the history to the answered message. */
  onJumpTo?: (messageId: string) => void
  /** Briefly marks the message the reader jumped to. */
  highlighted?: boolean
  /** Replaces the text while the author edits it. */
  editing?: ReactNode
  /** Reactions and actions, laid out under the text. */
  children?: ReactNode
}

export const MessageCard = ({
  message,
  startsGroup,
  mentionsMe = false,
  myNickname,
  replyTo,
  onJumpTo,
  highlighted = false,
  editing,
  children,
}: MessageCardProps) => {
  const deleted = message.deletedAt !== undefined

  return (
    <article
      data-message-id={message.id}
      className={cn(
        'group px-4 py-0.5',
        startsGroup && 'pt-3',
        mentionsMe && 'border-l-2 border-accent bg-surface',
        highlighted && 'bg-surface-hover ring-1 ring-accent',
      )}
      aria-label={startsGroup ? undefined : `Продолжение сообщений ${authorName(message)}`}
    >
      {startsGroup && (
        <header className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{authorName(message)}</span>
          <time dateTime={message.createdAt.toISOString()} className="text-xs text-fg-muted">
            {formatTime(message.createdAt)}
          </time>
        </header>
      )}

      {message.replyToId !== undefined &&
        (replyTo ? (
          <button
            type="button"
            aria-label={`Перейти к сообщению от ${authorName(replyTo)}`}
            className="flex max-w-full items-baseline gap-1 truncate text-left text-xs text-fg-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            onClick={() => {
              onJumpTo?.(replyTo.id)
            }}
          >
            <span aria-hidden="true">↩</span>
            <span className="font-medium">{authorName(replyTo)}</span>
            <span className="truncate">{messagePreview(replyTo)}</span>
          </button>
        ) : (
          <p className="text-xs text-fg-muted">
            <span aria-hidden="true">↩ </span>Ответ на сообщение
          </p>
        ))}

      {editing ?? (
        <p className={cn('text-sm whitespace-pre-wrap', deleted && 'text-fg-muted italic')}>
          {deleted ? (
            'Сообщение удалено'
          ) : (
            <MessageText content={message.content} mention={mentionsMe ? myNickname : undefined} />
          )}
          {!deleted && message.editedAt && (
            <span className="ml-1 text-xs text-fg-muted">(изменено)</span>
          )}
        </p>
      )}

      {children}
    </article>
  )
}
