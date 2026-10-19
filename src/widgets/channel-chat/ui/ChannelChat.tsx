import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { type Message } from '@/entities/message'
import { useSession } from '@/entities/session'
import { useReadOnView } from '@/entities/unread'
import {
  AttachButton,
  PendingAttachments,
  useAttachmentUploads,
  useFileDrop,
} from '@/features/attach-file'
import { SendMessage } from '@/features/send-message'
import { isApiError } from '@/shared/api'
import { usePageVisible } from '@/shared/lib/page-visibility'
import { Button } from '@/shared/ui/button'

import { MessageRow } from './MessageRow'
import { useChannelHistory } from './useChannelHistory'

interface ChannelChatProps {
  workspaceId: string
  channelId: string
  /** False in a read-only channel: the composer is then not offered. */
  canWrite: boolean
  /** False when the server does not let this member attach files. */
  canAttach: boolean
}

/** How close to the bottom still counts as "reading the newest", in pixels. */
const BOTTOM_THRESHOLD = 80
/** A first guess at a message's height; the virtualizer measures the real one. */
const ESTIMATED_ROW = 56
/** How long the message the reader jumped to stays marked. */
const HIGHLIGHT_MS = 2000

/**
 * The messages of one channel. The list is virtualized, so a long history
 * scrolls at the same speed as a short one; older pages load as the reader
 * goes up, and new messages stick to the bottom only while the reader is there.
 */
export const ChannelChat = ({ workspaceId, channelId, canWrite, canAttach }: ChannelChatProps) => {
  const { user } = useSession()
  const { messages, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useChannelHistory(channelId)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [replyTo, setReplyTo] = useState<Message | undefined>(undefined)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [highlightedId, setHighlightedId] = useState<string | undefined>(undefined)
  const pageVisible = usePageVisible()
  const uploads = useAttachmentUploads(channelId)
  const { dragging, dropProps } = useFileDrop(uploads.add)

  // Read means seen: the newest message on screen, in a tab that is not hidden.
  const { lastReadSeq } = useReadOnView({
    workspaceId,
    channelId,
    newestSeq: messages.at(-1)?.seq,
    viewing: atBottom && pageVisible && !isPending,
  })

  // Where the cursor stood when the channel was opened. Reading moves the
  // cursor at once, but the divider stays put until the reader leaves.
  const [dividerAt, setDividerAt] = useState<{ channelId: string; seq: bigint } | undefined>(
    undefined,
  )
  if (lastReadSeq !== undefined && dividerAt?.channelId !== channelId) {
    setDividerAt({ channelId, seq: lastReadSeq })
  }
  const firstUnreadId =
    dividerAt?.channelId === channelId
      ? messages.find((message) => message.seq > dividerAt.seq && message.author?.id !== user?.id)
          ?.id
      : undefined

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW,
    overscan: 12,
    getItemKey: (index) => messages[index]?.id ?? index,
  })

  // Someone reading older messages must not be yanked back down by a new one.
  useEffect(() => {
    if (atBottom) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end' })
    }
  }, [messages.length, atBottom, virtualizer])

  // The mark on a jumped-to message is temporary.
  useEffect(() => {
    if (highlightedId === undefined) {
      return undefined
    }
    const timer = setTimeout(() => {
      setHighlightedId(undefined)
    }, HIGHLIGHT_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [highlightedId])

  // Opening a channel starts at the newest message, as a chat should.
  useLayoutEffect(() => {
    setAtBottom(true)
    setReplyTo(undefined)
    setEditingId(undefined)
    setHighlightedId(undefined)
  }, [channelId])

  const jumpTo = (messageId: string) => {
    const index = messages.findIndex((message) => message.id === messageId)
    if (index === -1) {
      return
    }
    virtualizer.scrollToIndex(index, { align: 'center' })
    setHighlightedId(messageId)
  }

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight
    setAtBottom(distance <= BOTTOM_THRESHOLD)

    // Near the top: bring in what came before.
    if (element.scrollTop < ESTIMATED_ROW * 2 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }

  // The history is the source of truth: a reply preview follows the message it
  // answers, including its edit or delete, instead of keeping an old copy.
  const activeReply =
    replyTo === undefined ? undefined : messages.find((message) => message.id === replyTo.id)

  return (
    <section
      aria-label="Чат"
      className="relative flex min-h-0 flex-1 flex-col"
      {...(canWrite && canAttach ? dropProps : {})}
    >
      {dragging && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-md border-2 border-dashed border-accent bg-bg/80 text-sm font-semibold"
        >
          Отпустите, чтобы прикрепить файлы
        </div>
      )}
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
            if (!message) {
              return null
            }
            const replyTarget =
              message.replyToId === undefined
                ? undefined
                : messages.find((item) => item.id === message.replyToId)
            return (
              <div
                key={row.key}
                ref={virtualizer.measureElement}
                data-index={row.index}
                className="absolute top-0 left-0 w-full"
                style={{ transform: `translateY(${String(row.start)}px)` }}
              >
                {message.id === firstUnreadId && <NewMessagesDivider />}
                <MessageRow
                  message={message}
                  previous={messages[row.index - 1]}
                  mentionsMe={user ? message.mentions.includes(user.id) : false}
                  myNickname={user?.nickname}
                  canWrite={canWrite}
                  replyTo={replyTarget}
                  editing={editingId === message.id}
                  highlighted={highlightedId === message.id}
                  onStartEdit={() => {
                    setEditingId(message.id)
                  }}
                  onStopEdit={() => {
                    setEditingId(undefined)
                  }}
                  onReply={() => {
                    setReplyTo(message)
                  }}
                  onJumpTo={jumpTo}
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
        <SendMessage
          workspaceId={workspaceId}
          channelId={channelId}
          {...(activeReply === undefined ? {} : { replyTo: activeReply })}
          onCancelReply={() => {
            setReplyTo(undefined)
          }}
          onSent={() => {
            setReplyTo(undefined)
          }}
          attachmentIds={uploads.attachmentIds}
          attachmentsBusy={uploads.uploading}
          attachments={<PendingAttachments items={uploads.items} onRemove={uploads.remove} />}
          attachControl={canAttach ? <AttachButton onFiles={uploads.add} /> : undefined}
          onPasteFiles={canAttach ? uploads.add : undefined}
          onSending={uploads.clear}
        />
      ) : (
        <p className="border-t border-border p-4 text-sm text-fg-muted">
          В этом канале пишут только администраторы.
        </p>
      )}
    </section>
  )
}

/** Marks where the unread part of the channel begins. */
const NewMessagesDivider = () => {
  return (
    <div
      role="separator"
      aria-label="Новые сообщения"
      className="flex items-center gap-2 px-4 py-1"
    >
      <span aria-hidden="true" className="h-px flex-1 bg-danger" />
      <span aria-hidden="true" className="text-xs font-semibold text-danger">
        Новые сообщения
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-danger" />
    </div>
  )
}
