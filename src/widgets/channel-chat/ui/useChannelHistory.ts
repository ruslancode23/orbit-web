import { useInfiniteQuery } from '@tanstack/react-query'

import { type Message } from '@/entities/message'
import { listMessagesInfiniteOptions } from '@/shared/api'

/** How many messages one page holds; the server caps it at 100. */
const PAGE_SIZE = 50

/**
 * The history of one channel, oldest first for rendering, loaded page by page
 * backwards. The server returns each page newest first and hands back the
 * cursor for the next one, so paging never repeats or skips a message.
 */
export function useChannelHistory(channelId: string) {
  const query = useInfiniteQuery({
    ...listMessagesInfiniteOptions({
      path: { channelId },
      query: { limit: PAGE_SIZE },
    }),
    // The first page asks for the newest messages: no cursor at all.
    initialPageParam: { path: { channelId }, query: { limit: PAGE_SIZE } },
    // The next page asks for what came before the oldest message of this one.
    getNextPageParam: (lastPage) =>
      lastPage.nextBefore === undefined
        ? null
        : {
            path: { channelId },
            query: { limit: PAGE_SIZE, before: lastPage.nextBefore },
          },
    // The chat shows what the live stream already keeps fresh.
    staleTime: 60_000,
  })

  const messages: Message[] = []
  // Pages go from newest to oldest; each page is newest first inside itself.
  for (const page of [...(query.data?.pages ?? [])].reverse()) {
    messages.push(...[...page.messages].reverse())
  }

  return {
    messages,
    isPending: query.isPending,
    error: query.error,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  }
}
