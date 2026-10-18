import { cn } from '@/shared/lib/cn'

import { authorName, formatTime, type Message } from '../model/message'

interface MessageCardProps {
  message: Message
  /** False for a message that continues the block above it. */
  startsGroup: boolean
  /** Highlights a message that names the person reading it. */
  mentionsMe?: boolean
}

export function MessageCard({ message, startsGroup, mentionsMe = false }: MessageCardProps) {
  const deleted = message.deletedAt !== undefined

  return (
    <article
      className={cn('px-4 py-0.5', startsGroup && 'pt-3', mentionsMe && 'bg-surface')}
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
      <p className={cn('text-sm whitespace-pre-wrap', deleted && 'text-fg-muted italic')}>
        {deleted ? 'Сообщение удалено' : message.content}
        {!deleted && message.editedAt && (
          <span className="ml-1 text-xs text-fg-muted">(изменено)</span>
        )}
      </p>
    </article>
  )
}
