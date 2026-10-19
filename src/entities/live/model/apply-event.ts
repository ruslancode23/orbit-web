import {
  getWorkspaceQueryKey,
  listMessagesInfiniteQueryKey,
  listMessagesQueryKey,
  listUnreadQueryKey,
  listWorkspacesQueryKey,
} from '@/shared/api'

import type { LiveEvent } from './connection'
import type { QueryClient } from '@tanstack/react-query'

/**
 * Turns an event into "this is out of date": the data itself comes from the
 * API, so there is one source of truth and no second copy to keep in step.
 */
export const applyEvent = (queryClient: QueryClient, event: LiveEvent) => {
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
  // Someone joined, left, was banned or changed role: the member list and the
  // servers we are on may both have changed.
  if (event.type === 'member.changed') {
    void queryClient.invalidateQueries()
  }
}
