import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'

import {
  addConversationMembersMutation,
  getConversationOptions,
  getConversationQueryKey,
  getConversationUnreadQueryKey,
  hideConversationMutation,
  leaveConversationMutation,
  listConversationsInfiniteOptions,
  listConversationsInfiniteQueryKey,
  listConversationsQueryKey,
  listMessagesInfiniteQueryKey,
  listMessagesQueryKey,
  startConversation,
  startConversationMutation,
  unhideConversationMutation,
  updateConversation,
  updateConversationMutation,
  type Conversation,
  type ConversationMember,
  type ConversationPage,
  type ConversationSummary,
} from '@/shared/api'

/** How many dialogues one page of the sidebar holds; the server caps it at 100. */
const PAGE_SIZE = 20

/** The part of a conversation both a row of the list and its page carry. */
interface ConversationShape {
  kind: 'direct' | 'group'
  name?: string
  members: ConversationMember[]
}

/** One dialogue by id; the id is also the channel id its messages live in. */
export const useConversation = (conversationId: string | undefined) =>
  useQuery({
    ...getConversationOptions({ path: { conversationId: conversationId ?? '' } }),
    enabled: conversationId !== undefined && conversationId !== '',
  })

/**
 * The dialogues of this account page by page, liveliest first. The row already
 * holds everything a sidebar draws — the newest message, the group name and the
 * unread counts after this account's cursor — so one request is enough for a
 * whole screen and no history is read for a preview.
 */
export const useConversationSummaries = () => {
  const query = useInfiniteQuery({
    ...listConversationsInfiniteOptions({ query: { limit: PAGE_SIZE } }),
    // The first page asks for the liveliest dialogues: no cursor at all.
    initialPageParam: { query: { limit: PAGE_SIZE } },
    // The server hands back the cursor of the next page; absent means the end.
    getNextPageParam: (lastPage) =>
      lastPage.nextCursor === undefined
        ? null
        : { query: { limit: PAGE_SIZE, cursor: lastPage.nextCursor } },
    staleTime: 30_000,
  })

  const summaries = (query.data?.pages ?? []).flatMap((page) => page.conversations)

  return {
    summaries,
    isPending: query.isPending,
    error: query.error,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  }
}

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

type ConversationPages = InfiniteData<ConversationPage>

/** Applies a change to every loaded page of the list. */
const updateConversationPages = (
  queryClient: QueryClient,
  update: (pages: ConversationPage[]) => ConversationPage[],
) => {
  queryClient.setQueriesData<ConversationPages>(
    { queryKey: listConversationsInfiniteQueryKey() },
    (data) => (data ? { ...data, pages: update(data.pages) } : data),
  )
}

/** Drops a dialogue from the loaded list without waiting for the server. */
export const removeConversationSummary = (queryClient: QueryClient, conversationId: string) => {
  updateConversationPages(queryClient, (pages) =>
    pages.map((page) => ({
      ...page,
      conversations: page.conversations.filter(
        (conversation) => conversation.id !== conversationId,
      ),
    })),
  )
}

/** Puts a changed dialogue back into the list, or refreshes it if it is there. */
const replaceConversationSummary = (queryClient: QueryClient, conversation: Conversation) => {
  updateConversationPages(queryClient, (pages) =>
    pages.map((page) => ({
      ...page,
      conversations: page.conversations.map((summary) =>
        summary.id === conversation.id
          ? {
              ...summary,
              kind: conversation.kind,
              members: conversation.members,
              ...(conversation.name === undefined ? {} : { name: conversation.name }),
            }
          : summary,
      ),
    })),
  )
}

const invalidateHistory = (queryClient: QueryClient, conversationId: string) => {
  const path = { channelId: conversationId }
  void queryClient.invalidateQueries({ queryKey: listMessagesQueryKey({ path }) })
  void queryClient.invalidateQueries({ queryKey: listMessagesInfiniteQueryKey({ path }) })
}

/** What starting a group asks for: the people and, when typed, its title. */
export interface StartGroupVariables {
  userIds: string[]
  /** The optional title; absent or blank keeps the group unnamed. */
  name?: string
}

export interface StartedGroup {
  conversation: Conversation
  /**
   * The group exists, but the server did not save its optional title. The
   * caller still opens the dialogue and says so instead of creating a second
   * group by retrying.
   */
  nameFailed: boolean
}

/**
 * Creates a group with the chosen people. The conversation endpoint has no
 * name in its body — the title is set by a member afterwards — so a named
 * group is a create followed by a rename. A failed rename leaves the group
 * intact and is reported separately; the history is refreshed because the
 * rename writes a system line the feed must show without a reload.
 */
export const useStartGroupConversation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userIds, name }: StartGroupVariables): Promise<StartedGroup> => {
      const { data: created } = await startConversation({ body: { userIds } })
      const title = name?.trim() ?? ''
      if (title === '' || created.kind !== 'group') {
        return { conversation: created, nameFailed: false }
      }
      const { data: named } = await updateConversation({
        path: { conversationId: created.id },
        body: { name: title },
      }).catch(() => ({ data: null }))
      return named === null
        ? { conversation: created, nameFailed: true }
        : { conversation: named, nameFailed: false }
    },
    onSuccess: ({ conversation }) => {
      queryClient.setQueryData(
        getConversationQueryKey({ path: { conversationId: conversation.id } }),
        conversation,
      )
      void queryClient.invalidateQueries({ queryKey: listConversationsQueryKey() })
      invalidateHistory(queryClient, conversation.id)
    },
  })
}

/** Renames a group; the server refuses a direct dialogue with 409. */
export const useRenameConversation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    ...updateConversationMutation(),
    onSuccess: (conversation) => {
      queryClient.setQueryData(
        getConversationQueryKey({ path: { conversationId: conversation.id } }),
        conversation,
      )
      replaceConversationSummary(queryClient, conversation)
      void queryClient.invalidateQueries({ queryKey: listConversationsQueryKey() })
      invalidateHistory(queryClient, conversation.id)
    },
  })
}

/** Adds people to a group; a direct dialogue answers 409 instead of growing. */
export const useAddConversationMembers = () => {
  const queryClient = useQueryClient()

  return useMutation({
    ...addConversationMembersMutation(),
    onSuccess: (conversation) => {
      queryClient.setQueryData(
        getConversationQueryKey({ path: { conversationId: conversation.id } }),
        conversation,
      )
      replaceConversationSummary(queryClient, conversation)
      void queryClient.invalidateQueries({ queryKey: listConversationsQueryKey() })
      invalidateHistory(queryClient, conversation.id)
    },
  })
}

/** Leaves a group: the conversation and its history stop existing for this account. */
export const useLeaveConversation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    ...leaveConversationMutation(),
    onSuccess: (_answer, variables) => {
      const conversationId = variables.path.conversationId
      const path = { channelId: conversationId }
      queryClient.removeQueries({
        queryKey: getConversationQueryKey({ path: { conversationId } }),
      })
      queryClient.removeQueries({ queryKey: listMessagesQueryKey({ path }) })
      queryClient.removeQueries({ queryKey: listMessagesInfiniteQueryKey({ path }) })
      removeConversationSummary(queryClient, conversationId)
      void queryClient.invalidateQueries({ queryKey: listConversationsQueryKey() })
      void queryClient.invalidateQueries({ queryKey: getConversationUnreadQueryKey() })
    },
  })
}

/** Hides a dialogue from this account's sidebar; its other devices hear the event. */
export const useHideConversation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    ...hideConversationMutation(),
    onSuccess: (_answer, variables) => {
      removeConversationSummary(queryClient, variables.path.conversationId)
      void queryClient.invalidateQueries({ queryKey: getConversationUnreadQueryKey() })
    },
  })
}

/** Shows a hidden dialogue again, for example right after hiding it by mistake. */
export const useUnhideConversation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    ...unhideConversationMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listConversationsQueryKey() })
      void queryClient.invalidateQueries({ queryKey: getConversationUnreadQueryKey() })
    },
  })
}

/** The members of a conversation other than the reader. */
export const conversationMembersExcept = (conversation: ConversationShape, userId: string) =>
  conversation.members.filter((member) => member.id !== userId)

/**
 * The person on the other side of a pair dialogue. A group has no single peer,
 * so it has no peer at all; use `conversationName` for its title.
 */
export const conversationPeer = (
  conversation: ConversationShape,
  userId: string,
): ConversationMember | undefined => {
  if (conversation.kind !== 'direct') {
    return undefined
  }
  return conversationMembersExcept(conversation, userId)[0]
}

/**
 * What a row in the sidebar and the page header call this conversation: the
 * peer's nickname for a pair, the title the server keeps for a group. A group
 * without a title stays neutral instead of listing its members as its name.
 */
export const conversationName = (conversation: ConversationShape, userId: string): string => {
  if (conversation.kind === 'direct') {
    return conversationPeer(conversation, userId)?.nickname ?? 'Диалог'
  }
  const name = conversation.name?.trim() ?? ''
  return name === '' ? 'Групповой чат' : name
}

export type { ConversationSummary }
