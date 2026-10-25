import { useInfiniteQuery } from '@tanstack/react-query'

import { type Message } from '@/entities/message'
import { listMessagesInfiniteOptions } from '@/shared/api'
import { hashQueryKeyWithBigints } from '@/shared/lib/query-key'

/** How many messages one page holds; the server caps it at 100. */
const PAGE_SIZE = 50

/**
 * The history of one channel, oldest first for rendering, loaded page by page
 * backwards. The server returns each page newest first and hands back the
 * cursor for the next one, so paging never repeats or skips a message.
 */
export function useChannelHistory(channelId: string, initialBefore?: number) {
  // A jump opens the history ending at that message, not at the newest one.
  const firstPage =
    initialBefore === undefined
      ? { path: { channelId }, query: { limit: PAGE_SIZE } }
      : { path: { channelId }, query: { limit: PAGE_SIZE, before: BigInt(initialBefore) } }
  const query = useInfiniteQuery({
    ...listMessagesInfiniteOptions(firstPage),
    initialPageParam: firstPage,
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
    // A jumped-to window carries a bigint cursor, which the default hash cannot
    // serialize. The normal page keeps the default hash: the reaction and edit
    // cache updates match a query by that hash.
    ...(initialBefore === undefined ? {} : { queryKeyHashFn: hashQueryKeyWithBigints }),
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
