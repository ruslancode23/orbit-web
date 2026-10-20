import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getConversationOptions,
  getConversationQueryKey,
  listConversationsOptions,
  listConversationsQueryKey,
  startConversationMutation,
  type Conversation,
  type ConversationMember,
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
