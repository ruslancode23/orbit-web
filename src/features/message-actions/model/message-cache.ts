import { listMessagesInfiniteQueryKey, type Message, type MessagePage } from '@/shared/api'

import type { InfiniteData, QueryClient } from '@tanstack/react-query'

type History = InfiniteData<MessagePage>

/**
 * Puts one changed message into the loaded history, leaving every other page
 * and message untouched. A reaction, an edit or a delete returns the new
 * message, so refetching the whole history for it would be wasted work — and
 * would make the list jump while the reader is looking at it.
 */
export function replaceMessageInHistory(
  queryClient: QueryClient,
  channelId: string,
  message: Message,
): void {
  queryClient.setQueriesData<History>(
    { queryKey: listMessagesInfiniteQueryKey({ path: { channelId } }) },
    (history) => {
      if (!history) return history
      const index = history.pages.findIndex((page) =>
        page.messages.some((item) => item.id === message.id),
      )
      if (index === -1) return history
      const pages = history.pages.map((page, pageIndex) =>
        pageIndex === index
          ? {
              ...page,
              messages: page.messages.map((item) => (item.id === message.id ? message : item)),
            }
          : page,
      )
      return { ...history, pages }
    },
  )
}
