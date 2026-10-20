import { cn } from '@/shared/lib/cn'

interface FriendRequestBadgeProps {
  count: number
  className?: string
}

/**
 * Incoming friendship requests, told apart from unread messages: a second
 * mark on the rail button, not part of the unread number. The link around it
 * says the same in words, so the picture is hidden from assistive technology.
 */
export const FriendRequestBadge = ({ count, className }: FriendRequestBadgeProps) => {
  if (count <= 0) {
    return null
  }

  return (
    <span
      aria-hidden="true"
      title={`Входящие заявки: ${String(count)}`}
      className={cn(
        'flex min-w-4 items-center justify-center rounded-full border-2 border-surface bg-accent px-1 text-[10px] leading-4 font-semibold text-accent-fg',
        className,
      )}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}
