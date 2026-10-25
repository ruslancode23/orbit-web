import {
  getConversationQueryKey,
  getConversationUnreadQueryKey,
  getWorkspaceQueryKey,
  type ConversationPage,
  type Friend,
  type PresenceStatus,
  type VoicePresence,
  type WorkspaceMember,
  type WorkspaceMembership,
  listChannelOverridesQueryKey,
  listChannelsQueryKey,
  listMessagesInfiniteQueryKey,
  listConversationsQueryKey,
  listInvitesQueryKey,
  listMessagesQueryKey,
  listNotificationSettingsQueryKey,
  listRolesQueryKey,
  listUnreadQueryKey,
  listWorkspaceBansQueryKey,
  listWorkspaceMembersQueryKey,
  listWorkspacesQueryKey,
} from '@/shared/api'

import { applyUserProfile, parseUserProfile } from './user-updated'

import type { LiveEvent } from './connection'
import type { InfiniteData, QueryClient } from '@tanstack/react-query'

/**
 * Turns an event into "this is out of date": the data itself comes from the
 * API, so there is one source of truth and no second copy to keep in step.
 */
export const applyEvent = (queryClient: QueryClient, event: LiveEvent) => {
  // A dialogue is a channel without a server: its messages, its read cursor
  // and the hiding of it arrive on the account stream with no workspace.
  const personal = event.workspaceId === undefined
  const personalMessage =
    personal && event.channelId !== undefined && event.type.startsWith('message.')
  const conversationListChanged =
    event.type === 'conversation.created' ||
    event.type === 'conversation.updated' ||
    event.type === 'conversation.hidden' ||
    personalMessage ||
    (personal && event.type === 'read.changed')
  if (conversationListChanged) {
    // Another device of this account hid the dialogue: drop it here at once,
    // exactly as the account's own sidebar would, then let the server confirm.
    if (event.type === 'conversation.hidden' && readHidden(event.payload)) {
      const conversationId = event.channelId ?? readConversationId(event.payload)
      if (conversationId !== undefined) {
        removeConversationFromList(queryClient, conversationId)
      }
    }
    void queryClient.invalidateQueries({ queryKey: listConversationsQueryKey() })
    void queryClient.invalidateQueries({ queryKey: getConversationUnreadQueryKey() })
  }
  if (event.type === 'conversation.created' || event.type === 'conversation.updated') {
    // The open page holds the members and the title too: a person added or a
    // group renamed elsewhere must not leave a stale header behind.
    if (event.channelId !== undefined) {
      void queryClient.invalidateQueries({
        queryKey: getConversationQueryKey({ path: { conversationId: event.channelId } }),
      })
    }
    // The secret chat list key carries the device header; match it by name.
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'listSecretChats',
    })
  }
  if (event.type === 'secret.chat.deleted') {
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'listSecretChats',
    })
  }
  if (event.type.startsWith('message.') && event.channelId) {
    const path = { channelId: event.channelId }
    // Both shapes of the same history: the chat reads it page by page.
    void queryClient.invalidateQueries({ queryKey: listMessagesQueryKey({ path }) })
    void queryClient.invalidateQueries({ queryKey: listMessagesInfiniteQueryKey({ path }) })
  }
  if (event.workspaceId && (event.type.startsWith('message.') || event.type === 'read.changed')) {
    void queryClient.invalidateQueries({
      queryKey: listUnreadQueryKey({ path: { workspaceId: event.workspaceId } }),
    })
  }
  // Who is in a voice channel. The payload is the whole channel presence, so it
  // goes into the cached server; a refetch would only repeat it.
  if (event.type === 'voice.presence' && event.workspaceId) {
    const presence = parsePresence(event.payload)
    const key = getWorkspaceQueryKey({ path: { workspaceId: event.workspaceId } })
    if (presence) {
      queryClient.setQueryData(key, (current: { voice?: VoicePresence[] } | undefined) => {
        if (!current) {
          return current
        }
        const voice = current.voice ?? []
        const others = voice.filter((item) => item.channelId !== presence.channelId)
        return { ...current, voice: [...others, presence] }
      })
    } else {
      void queryClient.invalidateQueries({ queryKey: key })
    }
  }
  // The owner deleted a server. It leaves the rail at once, before the list is
  // asked again, and whatever was cached about it is dropped: every request
  // for it would answer 404 now.
  if (event.type === 'workspace.deleted' && event.workspaceId) {
    const deletedId = event.workspaceId
    queryClient.setQueryData<WorkspaceMembership[]>(listWorkspacesQueryKey(), (memberships) =>
      memberships?.filter((membership) => membership.workspace.id !== deletedId),
    )
    const path = { workspaceId: deletedId }
    for (const key of [
      getWorkspaceQueryKey({ path }),
      listChannelsQueryKey({ path }),
      listWorkspaceMembersQueryKey({ path }),
      listWorkspaceBansQueryKey({ path }),
      listUnreadQueryKey({ path }),
    ]) {
      queryClient.removeQueries({ queryKey: key })
    }
    invalidateQueriesById(queryClient, ['listWorkspaces', 'getMutual'])
  }
  // A new name, description, icon or member permissions. The server list is
  // what the rail, the header and the buttons read; the payload is not put in
  // the cache, the icon link in it is short-lived anyway.
  if (event.type === 'workspace.updated') {
    void queryClient.invalidateQueries({ queryKey: listWorkspacesQueryKey() })
    if (event.workspaceId) {
      void queryClient.invalidateQueries({
        queryKey: getWorkspaceQueryKey({ path: { workspaceId: event.workspaceId } }),
      })
    }
  }
  // A display name, avatar, accent, bio or custom status changed. The stream
  // carries the whole profile, so it replaces the copy in the feed and the
  // member lists instead of making everyone refetch them.
  if (event.type === 'user.updated') {
    const profile = parseUserProfile(event.payload)
    if (profile) {
      applyUserProfile(queryClient, profile)
    }
  }
  // A friend or a member of a server went online, idle, do-not-disturb or
  // offline. The payload is small and names one account, so the cached friend
  // and member are patched in place: the dot changes without refetching a list. The server already
  // applies "do not disturb" and invisibility, so the value is shown as is.
  if (event.type === 'presence.updated') {
    const state = parseFriendPresence(event.payload)
    if (state) {
      // The member column of every loaded server shows the same dot.
      queryClient.setQueriesData<WorkspaceMember[]>(
        { predicate: (query) => queryIdOf(query.queryKey) === 'listWorkspaceMembers' },
        (members) => {
          if (!Array.isArray(members)) {
            return members
          }
          return members.map((member) => {
            if (member.user.id !== state.userId || member.presence === state.status) {
              return member
            }
            return { ...member, presence: state.status }
          })
        },
      )
      queryClient.setQueriesData<Friend[]>(
        { predicate: (query) => queryIdOf(query.queryKey) === 'listFriends' },
        (friends) => {
          if (!Array.isArray(friends)) {
            return friends
          }
          return friends.map((friend) => {
            if (friend.id !== state.userId || friend.presence === state.status) {
              return friend
            }
            return { ...friend, presence: state.status }
          })
        },
      )
    }
  }
  // A request appeared or disappeared on either side. Both accounts hear it,
  // each with the direction it sees, so both lists are refreshed: the payload
  // carries no profile and the list is small.
  if (event.type === 'friend.request.created' || event.type === 'friend.request.removed') {
    invalidateQueriesById(queryClient, ['listFriendRequests'])
  }
  // A request became a friendship. The friend list gains a row and the
  // pending list loses one.
  if (event.type === 'friend.added') {
    invalidateQueriesById(queryClient, ['listFriends', 'listFriendRequests', 'getMutual'])
  }
  // A friendship ended, either because someone removed the friend or because
  // one side blocked the other. A block also changes the blocked list, which
  // the other side of the pair never sees.
  if (event.type === 'friend.removed') {
    invalidateQueriesById(queryClient, [
      'listFriends',
      'listFriendRequests',
      'listUserBlocks',
      'getMutual',
    ])
  }
  // Someone joined, left, was banned or changed role. What reads membership is
  // refreshed, and nothing else: the histories and profiles stay as they are.
  if (event.type === 'member.changed') {
    invalidateQueriesById(queryClient, ['listWorkspaces', 'getMutual'])
    if (event.workspaceId) {
      const path = { workspaceId: event.workspaceId }
      void queryClient.invalidateQueries({ queryKey: getWorkspaceQueryKey({ path }) })
      void queryClient.invalidateQueries({ queryKey: listWorkspaceMembersQueryKey({ path }) })
      void queryClient.invalidateQueries({ queryKey: listWorkspaceBansQueryKey({ path }) })
      // A new role changes canWrite in read-only channels.
      void queryClient.invalidateQueries({ queryKey: listChannelsQueryKey({ path }) })
    }
  }
  // Roles were made, changed, moved or deleted: colours, groups and what each
  // member may do — on the server and in its channels — follow them.
  if (event.type === 'roles.changed' && event.workspaceId) {
    const path = { workspaceId: event.workspaceId }
    invalidateQueriesById(queryClient, ['listWorkspaces', 'listChannelOverrides'])
    for (const key of [
      listRolesQueryKey({ path }),
      getWorkspaceQueryKey({ path }),
      listWorkspaceMembersQueryKey({ path }),
      listChannelsQueryKey({ path }),
    ]) {
      void queryClient.invalidateQueries({ queryKey: key })
    }
  }
  // The staff lists of a server: only its admins and owner hear these.
  if (event.type === 'invites.changed' && event.workspaceId) {
    void queryClient.invalidateQueries({
      queryKey: listInvitesQueryKey({ path: { workspaceId: event.workspaceId } }),
    })
  }
  if (event.type === 'bans.changed' && event.workspaceId) {
    void queryClient.invalidateQueries({
      queryKey: listWorkspaceBansQueryKey({ path: { workspaceId: event.workspaceId } }),
    })
  }
  // This account changed how loudly a server, channel or conversation speaks:
  // its other devices ask for the rows again.
  if (event.type === 'notification_settings.updated') {
    void queryClient.invalidateQueries({ queryKey: listNotificationSettingsQueryKey() })
  }
  // This account's own settings changed on another device: its block list,
  // who may write to it, who may send requests, its devices.
  if (event.type === 'privacy.changed') {
    invalidateQueriesById(queryClient, [
      'listUserBlocks',
      'getDmPolicy',
      'getFriendRequestPolicy',
      'getMutual',
    ])
  }
  if (event.type === 'devices.changed') {
    invalidateQueriesById(queryClient, ['listDevices'])
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'listSecretChats',
    })
  }
  // A channel appeared, changed, moved or went away. The event names it only:
  // canWrite in the list depends on who reads it, so the list is asked again.
  if ((event.type === 'channel.changed' || event.type === 'channel.deleted') && event.workspaceId) {
    void queryClient.invalidateQueries({
      queryKey: listChannelsQueryKey({ path: { workspaceId: event.workspaceId } }),
    })
    // An override changed what someone may do here.
    if (event.channelId) {
      void queryClient.invalidateQueries({
        queryKey: listChannelOverridesQueryKey({ path: { channelId: event.channelId } }),
      })
    }
    if (event.type === 'channel.deleted' && event.channelId) {
      // Its history cannot be asked for any more; the unread counts lose it.
      const path = { channelId: event.channelId }
      queryClient.removeQueries({ queryKey: listMessagesQueryKey({ path }) })
      queryClient.removeQueries({ queryKey: listMessagesInfiniteQueryKey({ path }) })
      void queryClient.invalidateQueries({
        queryKey: listUnreadQueryKey({ path: { workspaceId: event.workspaceId } }),
      })
    }
  }
}

/**
 * Everything the live stream keeps fresh. After a gap in the stream these may
 * have missed an event, so they are marked stale: the ones on screen are asked
 * again at once, the rest when they are shown next. Attachment links, the
 * session and static data are not here — no event ever refreshed them.
 */
const LIVE_QUERIES = [
  'listMessages',
  'listChannels',
  'listWorkspaces',
  'getWorkspace',
  'listWorkspaceMembers',
  'listWorkspaceBans',
  'listUnread',
  'listConversations',
  'getConversation',
  'getConversationUnread',
  'listFriends',
  'listFriendRequests',
  'listUserBlocks',
  'getMutual',
  'getUserProfile',
  'getChannel',
  'listInvites',
  'listDevices',
  'getDmPolicy',
  'getFriendRequestPolicy',
  'listRoles',
  'listChannelOverrides',
  'listNotificationSettings',
] as const

/**
 * The stream came back after a drop or after the server cut it for falling
 * behind. The catch-up by cursor replays new messages only; edits, reactions,
 * channels, members and statuses from the gap never arrive, so whatever the
 * stream normally refreshes is refreshed once here.
 */
export const refreshAfterGap = (queryClient: QueryClient) => {
  invalidateQueriesById(queryClient, LIVE_QUERIES)
  // The secret chat list key carries the device header; match it by name.
  void queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === 'listSecretChats',
  })
}

/** The name of a generated query, stored in the first part of its key. */
const queryIdOf = (queryKey: readonly unknown[]): string | undefined => {
  const params = queryKey[0]
  if (typeof params !== 'object' || params === null || !('_id' in params)) {
    return undefined
  }
  return typeof params._id === 'string' ? params._id : undefined
}

/** Whether the event says the dialogue was hidden (true) or shown again (false). */
const readHidden = (payload: unknown): boolean => {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'hidden' in payload &&
    payload.hidden === true
  )
}

/** `conversation.hidden` names the dialogue in its body as well as in the frame. */
const readConversationId = (payload: unknown): string | undefined => {
  if (typeof payload !== 'object' || payload === null || !('conversationId' in payload)) {
    return undefined
  }
  return typeof payload.conversationId === 'string' ? payload.conversationId : undefined
}

type ConversationListCache = ConversationPage | InfiniteData<ConversationPage>

/** Drops one dialogue from every loaded page of every cached conversation list. */
const removeConversationFromList = (queryClient: QueryClient, conversationId: string) => {
  const without = (page: ConversationPage): ConversationPage => ({
    ...page,
    conversations: page.conversations.filter((conversation) => conversation.id !== conversationId),
  })
  queryClient.setQueriesData<ConversationListCache>(
    { predicate: (query) => queryIdOf(query.queryKey) === 'listConversations' },
    (data) => {
      if (!data) {
        return data
      }
      if ('pages' in data) {
        return { ...data, pages: data.pages.map(without) }
      }
      return without(data)
    },
  )
}

/** Refreshes every cached query with one of the generated names. */
const invalidateQueriesById = (queryClient: QueryClient, ids: readonly string[]) => {
  void queryClient.invalidateQueries({
    predicate: (query) => {
      const id = queryIdOf(query.queryKey)
      return id !== undefined && ids.includes(id)
    },
  })
}

interface FriendPresenceState {
  userId: string
  status: PresenceStatus
}

const isPresenceStatus = (value: unknown): value is PresenceStatus => {
  return value === 'online' || value === 'idle' || value === 'dnd' || value === 'offline'
}

/** `presence.updated` carries the account, its visible status and when it changed. */
const parseFriendPresence = (payload: unknown): FriendPresenceState | null => {
  if (typeof payload !== 'object' || payload === null) {
    return null
  }
  if (!('userId' in payload) || typeof payload.userId !== 'string') {
    return null
  }
  if (!('status' in payload) || !isPresenceStatus(payload.status)) {
    return null
  }
  return { userId: payload.userId, status: payload.status }
}

const parsePresence = (payload: unknown): VoicePresence | null => {
  if (typeof payload !== 'object' || payload === null) {
    return null
  }
  if (!('channelId' in payload) || typeof payload.channelId !== 'string') {
    return null
  }
  if (!('participants' in payload) || !Array.isArray(payload.participants)) {
    return null
  }
  const participants: VoicePresence['participants'] = []
  for (const item of payload.participants) {
    if (!isParticipant(item)) {
      continue
    }
    participants.push(item)
  }
  return { channelId: payload.channelId, participants }
}

const isParticipant = (value: unknown): value is VoicePresence['participants'][number] => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return (
    'userId' in value &&
    typeof value.userId === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'muted' in value &&
    typeof value.muted === 'boolean' &&
    'deafened' in value &&
    typeof value.deafened === 'boolean' &&
    'screenSharing' in value &&
    typeof value.screenSharing === 'boolean'
  )
}
