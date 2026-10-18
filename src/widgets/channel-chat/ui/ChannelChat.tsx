import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { MessageCard, startsNewGroup } from '@/entities/message'
import { useSession } from '@/entities/session'
import { SendMessage } from '@/features/send-message'
import { isApiError } from '@/shared/api'
import { Button } from '@/shared/ui/button'

import { useChannelHistory } from './useChannelHistory'

interface ChannelChatProps {
  channelId: string
  /** False in a read-only channel: the composer is then not offered. */
  canWrite: boolean
}

/** How close to the bottom still counts as "reading the newest", in pixels. */
const BOTTOM_THRESHOLD = 80
/** A first guess at a message's height; the virtualizer measures the real one. */
const ESTIMATED_ROW = 56

/**
 * The messages of one channel. The list is virtualized, so a long history
 * scrolls at the same speed as a short one; older pages load as the reader
 * goes up, and new messages stick to the bottom only while the reader is there.
 */
export function ChannelChat({ channelId, canWrite }: ChannelChatProps) {
  const { user } = useSession()
  const { messages, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useChannelHistory(channelId)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [atBottom, setAtBottom] = useState(true)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW,
    overscan: 12,
    getItemKey: (index) => messages[index]?.id ?? index,
  })

  // Someone reading older messages must not be yanked back down by a new one.
  useEffect(() => {
    if (atBottom) virtualizer.scrollToIndex(messages.length - 1, { align: 'end' })
  }, [messages.length, atBottom, virtualizer])

  // Opening a channel starts at the newest message, as a chat should.
  useLayoutEffect(() => {
    setAtBottom(true)
  }, [channelId])

  function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    const element = event.currentTarget
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight
    setAtBottom(distance <= BOTTOM_THRESHOLD)

    // Near the top: bring in what came before.
    if (element.scrollTop < ESTIMATED_ROW * 2 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }

  return (
    <section aria-label="Чат" className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-label="Сообщения"
      >
        {isPending && (
          <p role="status" className="p-4 text-sm text-fg-muted">
            Загружаем сообщения…
          </p>
        )}
        {error && (
          <p role="alert" className="p-4 text-sm text-danger">
            {isApiError(error) && error.isNetworkError
              ? 'Нет соединения с сервером.'
              : 'Не получилось загрузить историю.'}
          </p>
        )}
        {isFetchingNextPage && (
          <p role="status" className="p-2 text-center text-xs text-fg-muted">
            Загружаем старые сообщения…
          </p>
        )}
        {!isPending && !error && messages.length === 0 && (
          <p className="p-4 text-sm text-fg-muted">Здесь пока ничего не написано.</p>
        )}

        <div
          className="relative w-full"
          style={{ height: `${String(virtualizer.getTotalSize())}px` }}
        >
          {virtualizer.getVirtualItems().map((row) => {
            const message = messages[row.index]
            if (!message) return null
            return (
              <div
                key={row.key}
                ref={virtualizer.measureElement}
                data-index={row.index}
                className="absolute top-0 left-0 w-full"
                style={{ transform: `translateY(${String(row.start)}px)` }}
              >
                <MessageCard
                  message={message}
                  startsGroup={startsNewGroup(message, messages[row.index - 1])}
                  mentionsMe={user ? message.mentions.includes(user.id) : false}
                />
              </div>
            )
          })}
        </div>
      </div>

      {!atBottom && (
        <Button
          variant="ghost"
          className="mx-auto mb-1"
          onClick={() => {
            setAtBottom(true)
          }}
        >
          К новым сообщениям
        </Button>
      )}

      {canWrite ? (
        <SendMessage channelId={channelId} />
      ) : (
        <p className="border-t border-border p-4 text-sm text-fg-muted">
          В этом канале пишут только администраторы.
        </p>
      )}
    </section>
  )
}
