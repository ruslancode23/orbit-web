import { QueryClient } from '@tanstack/react-query'

import { getWorkspaceQueryKey, listChannelsQueryKey, listWorkspacesQueryKey } from '@/shared/api'

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
