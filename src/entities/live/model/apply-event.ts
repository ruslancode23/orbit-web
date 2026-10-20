import {
  getWorkspaceQueryKey,
  type VoicePresence,
  listMessagesInfiniteQueryKey,
  listConversationsQueryKey,
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
  // A dialogue is a channel without a server: its messages and its own events
  // arrive on the account stream, with no workspace to invalidate.
  if (event.type === 'conversation.created' || event.type === 'conversation.updated') {
    void queryClient.invalidateQueries({ queryKey: listConversationsQueryKey() })
    // The secret chat list key carries the device header; match it by name.
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'listSecretChats',
    })
  }
  if (event.type === 'message.' && event.channelId) {
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
