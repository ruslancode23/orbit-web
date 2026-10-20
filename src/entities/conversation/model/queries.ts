import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getConversationOptions,
  getConversationQueryKey,
  listConversationsOptions,
  listConversationsQueryKey,
  listMessagesOptions,
  startConversationMutation,
  type Conversation,
  type ConversationMember,
  type Message,
} from '@/shared/api'

/** Every dialogue this account takes part in, in the order the server keeps it. */
export const useConversations = () => useQuery(listConversationsOptions())

/** One dialogue by id; the id is also the channel id its messages live in. */
export const useConversation = (conversationId: string | undefined) =>
  useQuery({
    ...getConversationOptions({ path: { conversationId: conversationId ?? '' } }),
    enabled: conversationId !== undefined && conversationId !== '',
  })

/**
 * Opens the pair dialogue with someone, or returns the one that already exists:
 * the server allows a single conversation per pair. The list is refreshed so
 * the sidebar shows the dialogue at once, and the answer is put into the
 * single-conversation cache, ready for the page that opens.
 */
export const useStartConversation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    ...startConversationMutation(),
    onSuccess: (conversation) => {
      queryClient.setQueryData(
        getConversationQueryKey({ path: { conversationId: conversation.id } }),
        conversation,
      )
      void queryClient.invalidateQueries({ queryKey: listConversationsQueryKey() })
    },
  })
}

/** The members of a conversation other than the reader. */
export const conversationMembersExcept = (conversation: Conversation, userId: string) =>
  conversation.members.filter((member) => member.id !== userId)

/**
 * The person on the other side of a pair dialogue. A group has no single peer,
 * so it has no peer at all; use `conversationName` for its title.
 */
export const conversationPeer = (
  conversation: Conversation,
  userId: string,
): ConversationMember | undefined => {
  if (conversation.kind !== 'direct') {
    return undefined
  }
  return conversationMembersExcept(conversation, userId)[0]
}

/**
 * What a row in the sidebar and the page header call this conversation: the
 * peer's nickname for a pair, the other members' nicknames for a group.
 */
export const conversationName = (conversation: Conversation, userId: string): string => {
  if (conversation.kind === 'direct') {
    return conversationPeer(conversation, userId)?.nickname ?? 'Диалог'
  }
  const names = conversationMembersExcept(conversation, userId).map((member) => member.nickname)
  return names.length > 0 ? names.join(', ') : 'Групповой чат'
}

/** A dialogue together with the newest message the list previews. */
export interface ConversationSummary {
  conversation: Conversation
  /** Absent while the dialogue has no messages, or while its latest page loads. */
  lastMessage?: Message
}

interface SummaryList {
  summaries: ConversationSummary[]
  isPending: boolean
  error: unknown
  isFetching: boolean
}

/** The latest message is one page of one: the list shows a single line of it. */
const LATEST_MESSAGE_LIMIT = 1

/**
 * The dialogues with their latest message, liveliest first.
 *
 * The current server contract has no summary on `GET /conversations`, so the
 * preview comes from the history endpoint — one small request per dialogue,
 * cached and shared by every preview. When conversation summaries arrive
 * (DM-2), this hook is the only place that changes.
 */
export const useConversationSummaries = (): SummaryList => {
  const conversations = useConversations()
  const ids = conversations.data?.map((conversation) => conversation.id) ?? []

  return useQueries({
    queries: ids.map((channelId) => ({
      ...listMessagesOptions({ path: { channelId }, query: { limit: LATEST_MESSAGE_LIMIT } }),
      staleTime: 30_000,
    })),
    combine: (results) => {
      const list: ConversationSummary[] = (conversations.data ?? []).map((conversation, index) => {
        const lastMessage = results[index]?.data?.messages[0]
        return lastMessage === undefined ? { conversation } : { conversation, lastMessage }
      })
      list.sort(byLastActivity)
      return {
        summaries: list,
        isPending: conversations.isPending,
        error: conversations.error,
        isFetching: conversations.isFetching || results.some((result) => result.isFetching),
      }
    },
  })
}

/** Moments with a message come first; a fresh dialogue without one follows by its birth. */
const byLastActivity = (a: ConversationSummary, b: ConversationSummary): number => {
  const left = a.lastMessage?.createdAt.getTime() ?? a.conversation.createdAt.getTime()
  const right = b.lastMessage?.createdAt.getTime() ?? b.conversation.createdAt.getTime()
  if (left !== right) {
    return right - left
  }
  return a.conversation.id.localeCompare(b.conversation.id)
}
