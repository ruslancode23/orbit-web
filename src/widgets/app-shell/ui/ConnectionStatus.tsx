import { useLive } from '@/entities/live'

const TEXT = {
  connecting: 'Подключаемся…',
  open: '',
  reconnecting: 'Нет соединения, переподключаемся…',
  offline: 'Нет связи с сервером. Пробуем снова.',
} as const

/**
 * A thin banner above the channel while the live connection is down. It is not
 * in the sidebar: the feed is what looks stale when the stream stops.
 */
export const ConnectionStatus = () => {
  const { status } = useLive()
  const text = TEXT[status]
  if (!text) {
    return null
  }

  return (
    <div
      role="status"
      className="flex shrink-0 items-center justify-center gap-2 border-b border-warning/40 bg-warning/10 px-3 py-1.5 text-xs text-warning"
    >
      <span
        aria-hidden="true"
        className="size-2 animate-pulse rounded-full bg-warning motion-reduce:animate-none"
      />
      {text}
    </div>
  )
}
