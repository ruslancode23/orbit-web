import { cn } from '@/shared/lib/cn'
import { Avatar } from '@/shared/ui/avatar'
import { ReplyIcon } from '@/shared/ui/icon'

import { MessageText } from './MessageText'
import {
  authorName,
  formatFullTime,
  formatRelativeTime,
  formatTime,
  messagePreview,
  type Message,
} from '../model/message'

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
  /** The files of the message, under its text. Not shown once it is deleted. */
  attachments?: ReactNode
  /** The floating actions panel, shown on hover and on keyboard focus. */
  actions?: ReactNode
  /** Reactions, laid out under the text. */
  children?: ReactNode
  /**
   * Wraps the author's avatar and name, e.g. with the user card. The entity
   * cannot import a feature, so the widget above it supplies the surface.
   */
  renderAuthorPart?: (part: 'avatar' | 'name', content: ReactNode) => ReactNode
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
  attachments,
  actions,
  children,
  renderAuthorPart,
}: MessageCardProps) => {
  const deleted = message.deletedAt !== undefined
  // A message of files alone has no text to print.
  const hasText = deleted || message.content !== '' || message.editedAt !== undefined
  const fullTime = formatFullTime(message.createdAt)
  const authorPart = (part: 'avatar' | 'name', content: ReactNode) => {
    return message.author !== undefined && renderAuthorPart !== undefined
      ? renderAuthorPart(part, content)
      : content
  }

  return (
    <article
      data-message-id={message.id}
      className={cn(
        'group relative px-4 py-0.5 focus-within:z-10 hover:z-10',
        startsGroup && 'mt-3',
        mentionsMe && 'border-l-2 border-accent bg-accent/10',
        highlighted && 'bg-surface-hover ring-1 ring-accent',
      )}
      aria-label={startsGroup ? undefined : `Продолжение сообщений ${authorName(message)}`}
    >
      {actions !== undefined && <div className="absolute top-0 right-4 z-10">{actions}</div>}

      <div className="flex gap-3">
        {startsGroup ? (
          authorPart(
            'avatar',
            <Avatar
              name={authorName(message)}
              src={message.author?.avatarUrl}
              accent={message.author?.accentColor}
              size={40}
              decorative
              className="mt-0.5"
            />,
          )
        ) : (
          <span
            aria-hidden="true"
            className="w-9 shrink-0 pt-0.5 text-right text-[10px] text-fg-muted opacity-0 transition-opacity group-hover:opacity-100"
          >
            {formatTime(message.createdAt)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          {startsGroup && (
            <header className="flex items-baseline gap-2">
              {authorPart(
                'name',
                <span className="text-sm font-semibold">{authorName(message)}</span>,
              )}
              <time
                dateTime={message.createdAt.toISOString()}
                title={fullTime}
                className="text-xs text-fg-muted"
              >
                {formatRelativeTime(message.createdAt)}
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
                <ReplyIcon className="size-3 shrink-0" />
                <span className="font-medium">{authorName(replyTo)}</span>
                <span className="truncate">{messagePreview(replyTo)}</span>
              </button>
            ) : (
              <p className="flex items-center gap-1 text-xs text-fg-muted">
                <ReplyIcon className="size-3" />
                Ответ на сообщение
              </p>
            ))}

          {editing ??
            (hasText && (
              <p className={cn('text-sm whitespace-pre-wrap', deleted && 'text-fg-muted italic')}>
                {deleted ? (
                  'Сообщение удалено'
                ) : (
                  <MessageText
                    content={message.content}
                    mention={mentionsMe ? myNickname : undefined}
                  />
                )}
                {!deleted && message.editedAt && (
                  <span className="ml-1 text-[11px] text-fg-muted">(изменено)</span>
                )}
              </p>
            ))}

          {!deleted && attachments}

          {children}
        </div>
      </div>
    </article>
  )
}
