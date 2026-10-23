import { QueryClient } from '@tanstack/react-query'

import {
  getConversationQueryKey,
  getConversationUnreadQueryKey,
  getDmPolicyQueryKey,
  getUserProfileQueryKey,
  getWorkspaceQueryKey,
  listChannelsQueryKey,
  listConversationsQueryKey,
  listDevicesQueryKey,
  listFriendRequestsQueryKey,
  listFriendsQueryKey,
  listInvitesQueryKey,
  listMessagesQueryKey,
  listNotificationSettingsQueryKey,
  listUnreadQueryKey,
  listUserBlocksQueryKey,
  listWorkspaceBansQueryKey,
  listWorkspaceMembersQueryKey,
  listWorkspacesQueryKey,
} from '@/shared/api'

import { applyEvent } from './apply-event'

import type { LiveEvent } from './connection'

const workspaceId = '11111111-1111-4111-8111-111111111111'
const channelId = '22222222-2222-4222-8222-222222222222'
const userId = '33333333-3333-4333-8333-333333333333'

/**
 * Every event the server sends (orbit-server `internal/events`) and the frame
 * it arrives in. A new kind there belongs here too: the test below then proves
 * the client does something with it. `secret.envelope` is left out on purpose —
 * the secret chat page decrypts it through its own listener, not the cache.
 */
const SERVER_EVENTS: LiveEvent[] = [
  { type: 'message.created', workspaceId, channelId, seq: 1 },
  { type: 'message.updated', workspaceId, channelId, seq: 1 },
  { type: 'message.deleted', workspaceId, channelId, seq: 1 },
  { type: 'message.reaction', workspaceId, channelId, seq: 1 },
  { type: 'channel.changed', workspaceId, channelId, payload: { channelId } },
  { type: 'channel.deleted', workspaceId, channelId, payload: { channelId } },
  { type: 'member.changed', workspaceId, payload: { userId, role: 'member', present: true } },
  {
    type: 'voice.presence',
    workspaceId,
    payload: { channelId, participants: [] },
  },
  {
    type: 'presence.updated',
    workspaceId,
    payload: { userId, status: 'online', updatedAt: '2026-10-22T10:00:00Z' },
  },
  { type: 'workspace.updated', workspaceId, payload: {} },
  { type: 'workspace.deleted', workspaceId, payload: { workspaceId } },
  { type: 'roles.changed', workspaceId },
  {
    type: 'user.updated',
    payload: {
      id: userId,
      nickname: 'anna',
      displayName: 'Анна',
      accentColor: 'slate',
      bio: '',
      isGuest: false,
      createdAt: '2026-10-18T10:00:00Z',
    },
  },
  { type: 'read.changed', workspaceId, channelId },
  { type: 'read.changed', channelId },
  { type: 'conversation.created', channelId },
  { type: 'conversation.updated', channelId },
  { type: 'conversation.hidden', channelId, payload: { conversationId: channelId, hidden: true } },
  { type: 'secret.chat.deleted', channelId },
  { type: 'friend.request.created', payload: {} },
  { type: 'friend.request.removed', payload: {} },
  { type: 'friend.added', payload: {} },
  { type: 'friend.removed', payload: {} },
  { type: 'invites.changed', workspaceId },
  { type: 'bans.changed', workspaceId },
  { type: 'privacy.changed' },
  { type: 'devices.changed' },
  { type: 'notification_settings.updated', payload: { scope: 'channel', targetId: channelId } },
]

/** A cache with something under every key an event may touch. */
const seeded = (): QueryClient => {
  const queryClient = new QueryClient()
  const path = { workspaceId }
  const keys: (readonly unknown[])[] = [
    listWorkspacesQueryKey(),
    getWorkspaceQueryKey({ path }),
    listChannelsQueryKey({ path }),
    listWorkspaceMembersQueryKey({ path }),
    listWorkspaceBansQueryKey({ path }),
    listInvitesQueryKey({ path }),
    listUnreadQueryKey({ path }),
    listMessagesQueryKey({ path: { channelId } }),
    listConversationsQueryKey(),
    getConversationQueryKey({ path: { conversationId: channelId } }),
    getConversationUnreadQueryKey(),
    listFriendsQueryKey(),
    listFriendRequestsQueryKey({ query: { direction: 'incoming' } }),
    listUserBlocksQueryKey(),
    getDmPolicyQueryKey(),
    listDevicesQueryKey(),
    listNotificationSettingsQueryKey(),
    getUserProfileQueryKey({ path: { userId } }),
    ['listSecretChats', 'device-1'],
  ]
  for (const key of keys) {
    queryClient.setQueryData(key, [])
  }
  // Pages have their own shape.
  queryClient.setQueryData(listConversationsQueryKey(), { conversations: [] })
  queryClient.setQueryData(listMessagesQueryKey({ path: { channelId } }), { messages: [] })
  queryClient.setQueryData(getConversationQueryKey({ path: { conversationId: channelId } }), {
    id: channelId,
    kind: 'direct',
    members: [],
  })
  queryClient.setQueryData(getUserProfileQueryKey({ path: { userId } }), {
    id: userId,
    nickname: 'anna',
    displayName: '',
    accentColor: 'slate',
    bio: '',
    isGuest: false,
    createdAt: new Date('2026-10-18T10:00:00Z'),
  })
  return queryClient
}

// A kind the server sends but the client ignores is a live update that never
// shows. Each one must invalidate, patch or drop something in the cache.
it.each(SERVER_EVENTS.map((event) => [event.type, event] as const))(
  '%s changes the cache',
  (_type, event) => {
    const queryClient = seeded()
    let touched = 0
    const unsubscribe = queryClient.getQueryCache().subscribe((change) => {
      if (change.type === 'updated' || change.type === 'removed') {
        touched += 1
      }
    })

    applyEvent(queryClient, event)
    unsubscribe()

    expect(touched).toBeGreaterThan(0)
  },
)
