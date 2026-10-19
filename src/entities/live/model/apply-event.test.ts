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
