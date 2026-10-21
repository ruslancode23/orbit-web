import {
  getCurrentUserQueryKey,
  getUserProfileQueryKey,
  type Conversation,
  type ConversationMember,
  type ConversationPage,
  type ConversationSummary,
  type CustomStatus,
  type MessagePage,
  type SelfProfile,
  type UserProfile,
  type WorkspaceMember,
} from '@/shared/api'

import type { InfiniteData, Query, QueryClient } from '@tanstack/react-query'

const ACCENT_COLORS: readonly string[] = [
  'slate',
  'red',
  'amber',
  'green',
  'teal',
  'sky',
  'indigo',
  'violet',
  'pink',
]

const isAccentColor = (value: string): value is UserProfile['accentColor'] => {
  return ACCENT_COLORS.includes(value)
}

/** A property of an unknown JSON object, without assuming its shape. */
const readField = (value: object, key: string): unknown => {
  return Object.getOwnPropertyDescriptor(value, key)?.value
}

const readString = (value: object, key: string): string | undefined => {
  const field = readField(value, key)
  return typeof field === 'string' ? field : undefined
}

const parseStatus = (value: unknown): CustomStatus | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  const status: CustomStatus = {}
  const emoji = readString(value, 'emoji')
  if (emoji !== undefined && emoji !== '') {
    status.emoji = emoji
  }
  const text = readString(value, 'text')
  if (text !== undefined && text !== '') {
    status.text = text
  }
  const expiresAt = readString(value, 'expiresAt')
  if (expiresAt !== undefined) {
    const moment = new Date(expiresAt)
    if (!Number.isNaN(moment.getTime())) {
      status.expiresAt = moment
    }
  }
  return status.emoji === undefined && status.text === undefined ? undefined : status
}

/**
 * The stream's `user.updated` payload is the same `UserProfile` the API
 * returns, but without the HTTP client's date conversion. It is turned into
 * the API shape here, so the cache never holds half a profile.
 */
export const parseUserProfile = (payload: unknown): UserProfile | null => {
  if (typeof payload !== 'object' || payload === null) {
    return null
  }
  const id = readString(payload, 'id')
  const nickname = readString(payload, 'nickname')
  const displayName = readString(payload, 'displayName')
  const accentColor = readString(payload, 'accentColor')
  const createdAt = readString(payload, 'createdAt')
  if (id === undefined || nickname === undefined || displayName === undefined) {
    return null
  }
  const created = createdAt === undefined ? new Date(0) : new Date(createdAt)
  const profile: UserProfile = {
    id,
    nickname,
    displayName,
    accentColor: accentColor !== undefined && isAccentColor(accentColor) ? accentColor : 'slate',
    bio: readString(payload, 'bio') ?? '',
    isGuest: readField(payload, 'isGuest') === true,
    createdAt: Number.isNaN(created.getTime()) ? new Date(0) : created,
  }
  const avatarUrl = readString(payload, 'avatarUrl')
  if (avatarUrl !== undefined) {
    profile.avatarUrl = avatarUrl
  }
  const customStatus = parseStatus(readField(payload, 'customStatus'))
  if (customStatus !== undefined) {
    profile.customStatus = customStatus
  }
  return profile
}

const queryId = (query: Query): string | undefined => {
  const params = query.queryKey[0]
  if (typeof params !== 'object' || params === null || !('_id' in params)) {
    return undefined
  }
  return typeof params._id === 'string' ? params._id : undefined
}

const isQuery = (id: string) => {
  return (query: Query) => {
    return queryId(query) === id
  }
}

const replaceMembers = (
  members: ConversationMember[],
  profile: UserProfile,
): ConversationMember[] => {
  return members.map((member) => (member.id === profile.id ? { ...member, ...profile } : member))
}

const replaceAuthorsInPage = (page: MessagePage, profile: UserProfile): MessagePage => {
  return {
    ...page,
    messages: page.messages.map((message) =>
      message.author?.id === profile.id ? { ...message, author: profile } : message,
    ),
  }
}

const replaceAuthors = (
  history: MessagePage | InfiniteData<MessagePage> | undefined,
  profile: UserProfile,
): MessagePage | InfiniteData<MessagePage> | undefined => {
  if (!history) {
    return history
  }
  if ('pages' in history) {
    return { ...history, pages: history.pages.map((page) => replaceAuthorsInPage(page, profile)) }
  }
  return replaceAuthorsInPage(history, profile)
}

const replaceSummaryProfile = (
  summary: ConversationSummary,
  profile: UserProfile,
): ConversationSummary => {
  const lastMessage = summary.lastMessage
  return {
    ...summary,
    members: replaceMembers(summary.members, profile),
    ...(lastMessage?.author?.id === profile.id
      ? { lastMessage: { ...lastMessage, author: profile } }
      : {}),
  }
}

const replaceConversationPageProfiles = (
  page: ConversationPage,
  profile: UserProfile,
): ConversationPage => {
  return {
    ...page,
    conversations: page.conversations.map((summary) => replaceSummaryProfile(summary, profile)),
  }
}

const replaceConversationListProfiles = (
  list: ConversationPage | InfiniteData<ConversationPage> | undefined,
  profile: UserProfile,
): ConversationPage | InfiniteData<ConversationPage> | undefined => {
  if (!list) {
    return list
  }
  if ('pages' in list) {
    return {
      ...list,
      pages: list.pages.map((page) => replaceConversationPageProfiles(page, profile)),
    }
  }
  return replaceConversationPageProfiles(list, profile)
}

/**
 * Puts a changed profile into every place that already holds it: the profile
 * cache, the loaded member lists, the conversations and the feed. They all
 * carry the same `UserProfile` inside their answers, so no refetch is needed
 * to redraw an avatar or a name.
 */
export const applyUserProfile = (queryClient: QueryClient, profile: UserProfile): void => {
  queryClient.setQueryData(getUserProfileQueryKey({ path: { userId: profile.id } }), profile)

  // The session keeps the email of this account; only the profile fields change.
  const me = queryClient.getQueryData<SelfProfile>(getCurrentUserQueryKey())
  if (me?.id === profile.id) {
    queryClient.setQueryData<SelfProfile>(getCurrentUserQueryKey(), { ...me, ...profile })
  }

  queryClient.setQueriesData<WorkspaceMember[]>(
    { predicate: isQuery('listWorkspaceMembers') },
    (members) =>
      members?.map((member) =>
        member.user.id === profile.id ? { ...member, user: profile } : member,
      ),
  )

  queryClient.setQueriesData<ConversationPage | InfiniteData<ConversationPage>>(
    { predicate: isQuery('listConversations') },
    (list) => replaceConversationListProfiles(list, profile),
  )

  queryClient.setQueriesData<Conversation>(
    { predicate: isQuery('getConversation') },
    (conversation) =>
      conversation
        ? { ...conversation, members: replaceMembers(conversation.members, profile) }
        : conversation,
  )

  queryClient.setQueriesData<MessagePage | InfiniteData<MessagePage>>(
    { predicate: isQuery('listMessages') },
    (history) => replaceAuthors(history, profile),
  )
}
