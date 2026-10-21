import { QueryClient, type InfiniteData } from '@tanstack/react-query'

import {
  getCurrentUserQueryKey,
  getUserProfileQueryKey,
  getWorkspaceQueryKey,
  getConversationQueryKey,
  getConversationUnreadQueryKey,
  listChannelsQueryKey,
  listConversationsInfiniteQueryKey,
  listConversationsQueryKey,
  listFriendRequestsQueryKey,
  listFriendsQueryKey,
  listMessagesInfiniteQueryKey,
  listMessagesQueryKey,
  listUnreadQueryKey,
  listUserBlocksQueryKey,
  listWorkspaceMembersQueryKey,
  listWorkspacesQueryKey,
  type ConversationPage,
  type ConversationSummary,
  type Friend,
  type Message,
  type MessagePage,
  type SelfProfile,
  type UserProfile,
  type WorkspaceMember,
  type WorkspaceMembership,
} from '@/shared/api'

import { applyEvent, refreshAfterGap } from './apply-event'

const workspaceId = '11111111-1111-4111-8111-111111111111'

const seed = () => {
  const queryClient = new QueryClient()
  const keys = {
    workspaces: listWorkspacesQueryKey(),
    workspace: getWorkspaceQueryKey({ path: { workspaceId } }),
    channels: listChannelsQueryKey({ path: { workspaceId } }),
  }
  for (const key of Object.values(keys)) {
    queryClient.setQueryData(key, [])
  }
  const isStale = (key: readonly unknown[]) =>
    queryClient.getQueryState(key)?.isInvalidated ?? false
  return { queryClient, keys, isStale }
}

// Another admin renamed the server or changed its icon: everyone watching it
// redraws the rail and the buttons without reloading the page.
it('marks the servers stale on workspace.updated and leaves the rest alone', () => {
  const { queryClient, keys, isStale } = seed()

  applyEvent(queryClient, { type: 'workspace.updated', workspaceId, payload: {} })

  expect(isStale(keys.workspaces)).toBe(true)
  expect(isStale(keys.workspace)).toBe(true)
  expect(isStale(keys.channels)).toBe(false)
})

it('refreshes what reads membership, and only that, when the members changed', () => {
  const { queryClient, keys, isStale } = seed()
  const members = listWorkspaceMembersQueryKey({ path: { workspaceId } })
  const history = listMessagesQueryKey({ path: { channelId: 'c-general' } })
  const profile = getUserProfileQueryKey({ path: { userId: 'u-anna' } })
  for (const key of [members, history, profile]) {
    queryClient.setQueryData(key, {})
  }

  applyEvent(queryClient, { type: 'member.changed', workspaceId })

  expect(isStale(keys.workspaces)).toBe(true)
  expect(isStale(keys.workspace)).toBe(true)
  expect(isStale(members)).toBe(true)
  // A new role changes canWrite in read-only channels.
  expect(isStale(keys.channels)).toBe(true)
  // A join or a role change does not touch what people wrote or who they are.
  expect(isStale(history)).toBe(false)
  expect(isStale(profile)).toBe(false)
})

// Another admin created, renamed or moved a channel: the event names the channel
// only, because canWrite in the list depends on the reader.
it('asks for the channel list again on channel.changed', () => {
  const { queryClient, keys, isStale } = seed()

  applyEvent(queryClient, { type: 'channel.changed', workspaceId, channelId: 'c-new' })

  expect(isStale(keys.channels)).toBe(true)
  expect(isStale(keys.workspaces)).toBe(false)
})

it('drops the history of a deleted channel and refreshes the list and the counters', () => {
  const { queryClient, keys, isStale } = seed()
  const path = { channelId: 'c-gone' }
  const unread = listUnreadQueryKey({ path: { workspaceId } })
  const other = listMessagesQueryKey({ path: { channelId: 'c-kept' } })
  queryClient.setQueryData(listMessagesQueryKey({ path }), {})
  queryClient.setQueryData(listMessagesInfiniteQueryKey({ path }), {})
  queryClient.setQueryData(unread, {})
  queryClient.setQueryData(other, {})

  applyEvent(queryClient, { type: 'channel.deleted', workspaceId, channelId: 'c-gone' })

  expect(isStale(keys.channels)).toBe(true)
  expect(isStale(unread)).toBe(true)
  expect(queryClient.getQueryData(listMessagesQueryKey({ path }))).toBeUndefined()
  expect(queryClient.getQueryData(listMessagesInfiniteQueryKey({ path }))).toBeUndefined()
  expect(queryClient.getQueryData(other)).toBeDefined()
})

// Presence comes whole for one channel; putting it into the cached server is
// cheaper than asking for the server again on every join and leave.
it('patches one voice channel from voice.presence and keeps the others', () => {
  const { queryClient, keys } = seed()
  const other = '22222222-2222-4222-8222-222222222222'
  queryClient.setQueryData(keys.workspace, {
    voice: [{ channelId: other, participants: [] }],
  })

  applyEvent(queryClient, {
    type: 'voice.presence',
    workspaceId,
    payload: {
      channelId: '33333333-3333-4333-8333-333333333333',
      participants: [
        {
          userId: 'u-1',
          name: 'Anna',
          muted: false,
          deafened: false,
          screenSharing: false,
        },
      ],
    },
  })

  const membership = queryClient.getQueryData<{
    voice?: { channelId: string; participants: { name: string }[] }[]
  }>(keys.workspace)
  expect(membership?.voice).toHaveLength(2)
  expect(membership?.voice?.find((item) => item.channelId === other)).toBeDefined()
  expect(
    membership?.voice?.find((item) => item.channelId === '33333333-3333-4333-8333-333333333333')
      ?.participants[0]?.name,
  ).toBe('Anna')
})

it('asks for the server again when a presence payload is malformed', () => {
  const { queryClient, keys, isStale } = seed()
  queryClient.setQueryData(keys.workspace, { voice: [] })

  applyEvent(queryClient, { type: 'voice.presence', workspaceId, payload: { channelId: 42 } })

  expect(isStale(keys.workspace)).toBe(true)
})

// A display name, avatar or accent changed. The stream carries the whole
// profile, so the feed, the member list and the session can be redrawn from
// the cache instead of asking the server for all of them again.
it('writes user.updated into the profile, the feed, the members and the session', () => {
  const queryClient = new QueryClient()
  const userId = 'u-anna'
  const channelId = '22222222-2222-4222-8222-222222222222'
  const conversationId = '33333333-3333-4333-8333-333333333333'

  const profileKey = getUserProfileQueryKey({ path: { userId } })
  const membersKey = listWorkspaceMembersQueryKey({ path: { workspaceId } })
  const conversationsKey = listConversationsQueryKey()
  const historyKey = listMessagesInfiniteQueryKey({ path: { channelId } })

  const before: UserProfile = {
    id: userId,
    nickname: 'anna',
    displayName: 'Anna',
    accentColor: 'slate',
    bio: '',
    isGuest: false,
    createdAt: new Date('2026-10-01T10:00:00Z'),
  }
  const message: Message = {
    id: 'm-1',
    channelId,
    seq: 1n,
    kind: 'user',
    author: before,
    content: 'привет',
    mentions: [],
    reactions: [],
    createdAt: new Date('2026-10-18T10:00:00Z'),
  }

  queryClient.setQueryData(profileKey, before)
  queryClient.setQueryData<WorkspaceMember[]>(membersKey, [
    { user: before, role: 'member', joinedAt: new Date('2026-10-02T10:00:00Z') },
  ])
  queryClient.setQueryData<ConversationPage>(conversationsKey, {
    conversations: [
      {
        id: conversationId,
        kind: 'direct',
        members: [{ ...before, joinedAt: new Date('2026-10-03T10:00:00Z') }],
        createdAt: new Date('2026-10-03T10:00:00Z'),
        lastMessage: {
          id: 'm-1',
          seq: 1n,
          kind: 'user',
          author: before,
          content: 'привет',
          createdAt: new Date('2026-10-18T10:00:00Z'),
        },
        lastReadSeq: 0n,
        unread: 1,
        mentions: 0,
      },
    ],
  })
  queryClient.setQueryData(historyKey, {
    pages: [{ messages: [message] }],
    pageParams: [undefined],
  })
  queryClient.setQueryData<SelfProfile>(getCurrentUserQueryKey(), {
    ...before,
    email: 'anna@example.com',
    profileOnboardedAt: null,
  })

  applyEvent(queryClient, {
    type: 'user.updated',
    workspaceId,
    payload: {
      ...before,
      displayName: 'Анна',
      avatarUrl: 'https://files.test/anna.webp?signature=1',
      accentColor: 'violet',
      customStatus: { text: 'на связи' },
      createdAt: '2026-10-18T10:00:00Z',
    },
  })

  const profile = queryClient.getQueryData<UserProfile>(profileKey)
  expect(profile?.displayName).toBe('Анна')
  expect(profile?.avatarUrl).toBe('https://files.test/anna.webp?signature=1')
  expect(profile?.accentColor).toBe('violet')
  expect(profile?.createdAt).toBeInstanceOf(Date)
  expect(profile?.customStatus?.text).toBe('на связи')

  expect(queryClient.getQueryData<WorkspaceMember[]>(membersKey)?.[0]?.user.displayName).toBe(
    'Анна',
  )
  const conversations = queryClient.getQueryData<ConversationPage>(conversationsKey)
  expect(conversations?.conversations[0]?.members[0]?.displayName).toBe('Анна')
  expect(conversations?.conversations[0]?.lastMessage?.author?.displayName).toBe('Анна')

  const history = queryClient.getQueryData<{ pages: MessagePage[] }>(historyKey)
  expect(history?.pages[0]?.messages[0]?.author?.displayName).toBe('Анна')
  expect(history?.pages[0]?.messages[0]?.author?.avatarUrl).toBe(
    'https://files.test/anna.webp?signature=1',
  )

  // The session keeps the email it alone has; only the profile fields change.
  const me = queryClient.getQueryData<SelfProfile>(getCurrentUserQueryKey())
  expect(me?.email).toBe('anna@example.com')
  expect(me?.displayName).toBe('Анна')
})

// A rename or a new member must reach the open page, not only the sidebar row.
it('refreshes the open dialogue when a group changes', () => {
  const queryClient = new QueryClient()
  const detail = getConversationQueryKey({ path: { conversationId: 'c-group' } })
  queryClient.setQueryData(detail, {})

  applyEvent(queryClient, { type: 'conversation.updated', channelId: 'c-group', payload: {} })

  expect(queryClient.getQueryState(detail)?.isInvalidated).toBe(true)
})

// A dialogue is a channel without a server: its events arrive on the personal
// stream, so the query keys have no workspace in them.
it('marks the dialogue list stale when a conversation appears', () => {
  const queryClient = new QueryClient()
  const conversations = listConversationsQueryKey()
  queryClient.setQueryData(conversations, [])

  applyEvent(queryClient, { type: 'conversation.created', channelId: 'c-new', payload: {} })

  expect(queryClient.getQueryState(conversations)?.isInvalidated).toBe(true)
})

it('refreshes both shapes of a dialogue history on a personal message', () => {
  const queryClient = new QueryClient()
  const channelId = 'c-direct'
  const page = listMessagesQueryKey({ path: { channelId } })
  const history = listMessagesInfiniteQueryKey({ path: { channelId } })
  queryClient.setQueryData(page, { messages: [] })
  queryClient.setQueryData(history, { pages: [], pageParams: [] })

  applyEvent(queryClient, { type: 'message.created', channelId, seq: 2, payload: {} })

  expect(queryClient.getQueryState(page)?.isInvalidated).toBe(true)
  expect(queryClient.getQueryState(history)?.isInvalidated).toBe(true)
})

const conversationSummary = (id: string): ConversationSummary => ({
  id,
  kind: 'direct',
  members: [],
  createdAt: new Date('2026-10-20T10:00:00Z'),
  lastReadSeq: 0n,
  unread: 1,
  mentions: 0,
})

const seedConversationList = (queryClient: QueryClient, id = 'c-direct') => {
  const listKey = listConversationsInfiniteQueryKey()
  queryClient.setQueryData<InfiniteData<ConversationPage>>(listKey, {
    pages: [{ conversations: [conversationSummary(id)] }],
    pageParams: [undefined],
  })
  queryClient.setQueryData(getConversationUnreadQueryKey(), { unread: 1, mentions: 0 })
  return listKey
}

it('drops a hidden dialogue at once and refreshes the badge', () => {
  const queryClient = new QueryClient()
  const listKey = seedConversationList(queryClient)

  applyEvent(queryClient, {
    type: 'conversation.hidden',
    channelId: 'c-direct',
    payload: { conversationId: 'c-direct', hidden: true },
  })

  const list = queryClient.getQueryData<InfiniteData<ConversationPage>>(listKey)
  expect(list?.pages[0]?.conversations).toEqual([])
  expect(queryClient.getQueryState(getConversationUnreadQueryKey())?.isInvalidated).toBe(true)
})

it('refreshes the list and its badge on a personal message', () => {
  const queryClient = new QueryClient()
  const listKey = seedConversationList(queryClient)

  applyEvent(queryClient, { type: 'message.created', channelId: 'c-direct', seq: 2, payload: {} })

  expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true)
  expect(queryClient.getQueryState(getConversationUnreadQueryKey())?.isInvalidated).toBe(true)
})

it('refreshes the list and its badge when another device read a dialogue', () => {
  const queryClient = new QueryClient()
  const listKey = seedConversationList(queryClient)

  applyEvent(queryClient, {
    type: 'read.changed',
    channelId: 'c-direct',
    payload: { channelId: 'c-direct', lastReadSeq: 2, unread: 0, mentions: 0 },
  })

  expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true)
  expect(queryClient.getQueryState(getConversationUnreadQueryKey())?.isInvalidated).toBe(true)
})

it('refreshes the unread counters of a server on read.changed', () => {
  const queryClient = new QueryClient()
  const unread = listUnreadQueryKey({ path: { workspaceId } })
  queryClient.setQueryData(unread, [])

  applyEvent(queryClient, {
    type: 'read.changed',
    workspaceId,
    channelId: '22222222-2222-4222-8222-222222222222',
    payload: {},
  })

  expect(queryClient.getQueryState(unread)?.isInvalidated).toBe(true)
})

const friend = (id: string, nickname: string, presence: Friend['presence']): Friend => ({
  id,
  nickname,
  presence,
  since: new Date('2026-10-20T10:00:00Z'),
})

// The stream carries one account and its visible status, so the dot changes
// in place: no list request is needed and the other friends stay as they were.
it('patches one friend from presence.updated and keeps the others', () => {
  const queryClient = new QueryClient()
  const key = listFriendsQueryKey()
  queryClient.setQueryData<Friend[]>(key, [
    friend('u-anna', 'anna', 'online'),
    friend('u-bob', 'bob', 'idle'),
  ])

  applyEvent(queryClient, {
    type: 'presence.updated',
    payload: { userId: 'u-anna', status: 'dnd', updatedAt: '2026-10-20T10:00:00Z' },
  })

  const friends = queryClient.getQueryData<Friend[]>(key)
  expect(friends?.find((item) => item.id === 'u-anna')?.presence).toBe('dnd')
  expect(friends?.find((item) => item.id === 'u-bob')?.presence).toBe('idle')
  expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false)
})

it('leaves the friend list alone when the presence payload is unreadable', () => {
  const queryClient = new QueryClient()
  const key = listFriendsQueryKey()
  queryClient.setQueryData<Friend[]>(key, [friend('u-anna', 'anna', 'online')])

  applyEvent(queryClient, { type: 'presence.updated', payload: { userId: 'u-anna' } })

  expect(queryClient.getQueryData<Friend[]>(key)?.[0]?.presence).toBe('online')
})

it('refreshes both sides of the pending lists when a request appears or goes', () => {
  const queryClient = new QueryClient()
  const incoming = listFriendRequestsQueryKey({ query: { direction: 'incoming' } })
  const outgoing = listFriendRequestsQueryKey({ query: { direction: 'outgoing' } })
  const friends = listFriendsQueryKey()
  queryClient.setQueryData(incoming, [])
  queryClient.setQueryData(outgoing, [])
  queryClient.setQueryData(friends, [])

  applyEvent(queryClient, { type: 'friend.request.created', payload: {} })

  expect(queryClient.getQueryState(incoming)?.isInvalidated).toBe(true)
  expect(queryClient.getQueryState(outgoing)?.isInvalidated).toBe(true)
  expect(queryClient.getQueryState(friends)?.isInvalidated).toBe(false)
})

it('refreshes the friends and the pending list when a request is accepted', () => {
  const queryClient = new QueryClient()
  const friends = listFriendsQueryKey()
  const requests = listFriendRequestsQueryKey({ query: { direction: 'incoming' } })
  queryClient.setQueryData(friends, [])
  queryClient.setQueryData(requests, [])

  applyEvent(queryClient, { type: 'friend.added', payload: {} })

  expect(queryClient.getQueryState(friends)?.isInvalidated).toBe(true)
  expect(queryClient.getQueryState(requests)?.isInvalidated).toBe(true)
})

it('refreshes friends, requests and blocks when a friendship ends', () => {
  const queryClient = new QueryClient()
  const friends = listFriendsQueryKey()
  const requests = listFriendRequestsQueryKey({ query: { direction: 'incoming' } })
  const blocks = listUserBlocksQueryKey()
  queryClient.setQueryData(friends, [])
  queryClient.setQueryData(requests, [])
  queryClient.setQueryData(blocks, [])

  applyEvent(queryClient, { type: 'friend.removed', payload: {} })

  expect(queryClient.getQueryState(friends)?.isInvalidated).toBe(true)
  expect(queryClient.getQueryState(requests)?.isInvalidated).toBe(true)
  expect(queryClient.getQueryState(blocks)?.isInvalidated).toBe(true)
})

// The member column shows the same dot as the friend list: the server sends
// presence.updated to everyone on a shared server, so the member is patched too.
it('patches the member of every loaded server from presence.updated', () => {
  const queryClient = new QueryClient()
  const first = listWorkspaceMembersQueryKey({ path: { workspaceId } })
  const second = listWorkspaceMembersQueryKey({
    path: { workspaceId: '22222222-2222-4222-8222-222222222222' },
  })
  const member = (id: string, presence: WorkspaceMember['presence']): WorkspaceMember => ({
    user: {
      id,
      nickname: id,
      displayName: '',
      accentColor: 'slate',
      bio: '',
      isGuest: false,
      createdAt: new Date(),
    },
    role: 'member',
    joinedAt: new Date(),
    presence,
  })
  queryClient.setQueryData<WorkspaceMember[]>(first, [
    member('u-bob', 'offline'),
    member('u-anna', 'online'),
  ])
  queryClient.setQueryData<WorkspaceMember[]>(second, [member('u-bob', 'offline')])

  applyEvent(queryClient, {
    type: 'presence.updated',
    workspaceId,
    payload: { userId: 'u-bob', status: 'online', updatedAt: '2026-10-21T10:00:00Z' },
  })

  const bobIn = (key: readonly unknown[]) =>
    queryClient.getQueryData<WorkspaceMember[]>(key)?.find((item) => item.user.id === 'u-bob')
  expect(bobIn(first)?.presence).toBe('online')
  expect(bobIn(second)?.presence).toBe('online')
  expect(
    queryClient.getQueryData<WorkspaceMember[]>(first)?.find((item) => item.user.id === 'u-anna')
      ?.presence,
  ).toBe('online')
  expect(queryClient.getQueryState(first)?.isInvalidated).toBe(false)
})

// After a gap in the stream, whatever the stream keeps fresh is asked again;
// what no event ever refreshed — attachment links, the session — is left alone.
it('marks the live data stale after a gap and leaves the rest', () => {
  const { queryClient, keys, isStale } = seed()
  const history = listMessagesInfiniteQueryKey({ path: { channelId: 'c-general' } })
  const members = listWorkspaceMembersQueryKey({ path: { workspaceId } })
  const dialogues = listConversationsInfiniteQueryKey()
  const session = getCurrentUserQueryKey()
  const secretChats = ['listSecretChats', 'device-1']
  for (const key of [history, members, dialogues, session, secretChats]) {
    queryClient.setQueryData(key, {})
  }

  refreshAfterGap(queryClient)

  for (const key of [
    keys.workspaces,
    keys.workspace,
    keys.channels,
    history,
    members,
    dialogues,
    secretChats,
  ]) {
    expect(isStale(key)).toBe(true)
  }
  expect(isStale(session)).toBe(false)
})

// The owner deleted a server: it leaves the rail at once, and what was cached
// about it is dropped, since every request for it would answer 404.
it('drops a deleted server from the rail and forgets its cache', () => {
  const queryClient = new QueryClient()
  const otherId = '22222222-2222-4222-8222-222222222222'
  const membership = (id: string): WorkspaceMembership => ({
    workspace: {
      id,
      name: id,
      description: null,
      iconUrl: null,
      ownerId: 'u-owner',
      createdAt: new Date(),
      memberPermissions: { canInvite: false, canCreateChannels: false, canAttachFiles: true },
    },
    role: 'member',
  })
  queryClient.setQueryData<WorkspaceMembership[]>(listWorkspacesQueryKey(), [
    membership(workspaceId),
    membership(otherId),
  ])
  const channels = listChannelsQueryKey({ path: { workspaceId } })
  const otherChannels = listChannelsQueryKey({ path: { workspaceId: otherId } })
  queryClient.setQueryData(channels, [])
  queryClient.setQueryData(otherChannels, [])

  applyEvent(queryClient, { type: 'workspace.deleted', workspaceId, payload: { workspaceId } })

  const left = queryClient.getQueryData<WorkspaceMembership[]>(listWorkspacesQueryKey())
  expect(left?.map((item) => item.workspace.id)).toEqual([otherId])
  expect(queryClient.getQueryData(channels)).toBeUndefined()
  expect(queryClient.getQueryData(otherChannels)).toBeDefined()
})
