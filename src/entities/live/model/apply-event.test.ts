import { QueryClient } from '@tanstack/react-query'

import {
  getCurrentUserQueryKey,
  getUserProfileQueryKey,
  getWorkspaceQueryKey,
  listChannelsQueryKey,
  listConversationsQueryKey,
  listMessagesInfiniteQueryKey,
  listWorkspaceMembersQueryKey,
  listWorkspacesQueryKey,
  type Conversation,
  type Message,
  type MessagePage,
  type SelfProfile,
  type UserProfile,
  type WorkspaceMember,
} from '@/shared/api'

import { applyEvent } from './apply-event'

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

it('marks everything stale when the members changed', () => {
  const { queryClient, keys, isStale } = seed()

  applyEvent(queryClient, { type: 'member.changed', workspaceId })

  expect(isStale(keys.workspaces)).toBe(true)
  expect(isStale(keys.channels)).toBe(true)
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
  queryClient.setQueryData<Conversation[]>(conversationsKey, [
    {
      id: conversationId,
      kind: 'direct',
      members: [{ ...before, joinedAt: new Date('2026-10-03T10:00:00Z') }],
      createdAt: new Date('2026-10-03T10:00:00Z'),
    },
  ])
  queryClient.setQueryData(historyKey, {
    pages: [{ messages: [message] }],
    pageParams: [undefined],
  })
  queryClient.setQueryData<SelfProfile>(getCurrentUserQueryKey(), {
    ...before,
    email: 'anna@example.com',
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
  expect(
    queryClient.getQueryData<Conversation[]>(conversationsKey)?.[0]?.members[0]?.displayName,
  ).toBe('Анна')

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
