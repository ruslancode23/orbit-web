import { cn } from '@/shared/lib/cn'

import type { UnreadTotal } from '../model/unread'

interface UnreadBadgeProps extends UnreadTotal {
  /** A dot instead of the number, for the narrow server rail. */
  compact?: boolean
  className?: string
}

/**
 * How much is unread, with mentions marked apart: a mention asks for the
 * reader, an ordinary message does not. It is only a picture: the link it
 * sits in says the same in words (`describeUnread`) in its accessible name.
 */
export const UnreadBadge = ({ unread, mentions, compact = false, className }: UnreadBadgeProps) => {
  if (unread === 0 && mentions === 0) return null

  const mentionPill = mentions > 0 && (
    <span className="min-w-5 rounded-full bg-danger px-1.5 text-center text-xs leading-5 font-semibold text-accent-fg">
      @{mentions}
    </span>
  )

  // The rail has room for one mark: a mention outranks a plain dot.
  if (compact) {
    return (
      <span aria-hidden="true" className={cn('flex items-center', className)}>
        {mentionPill || <span className="size-2 rounded-full bg-fg" />}
      </span>
    )
  }

  return (
    <span aria-hidden="true" className={cn('flex items-center gap-1', className)}>
      {unread > 0 && (
        <span className="min-w-5 rounded-full bg-surface-hover px-1.5 text-center text-xs leading-5 text-fg">
          {unread}
        </span>
      )}
      {mentionPill}
    </span>
  )
}
