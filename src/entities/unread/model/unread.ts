import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import {
  type ChannelUnread,
  getConversationUnreadOptions,
  getConversationUnreadQueryKey,
  listConversationsQueryKey,
  listMessagesOptions,
  listUnreadOptions,
  listUnreadQueryKey,
  markChannelReadMutation,
} from '@/shared/api'
import { pluralRu } from '@/shared/lib/plural'

export type { ChannelUnread }

/**
 * The live stream follows one server at a time, so the other servers in the
 * rail learn about new messages by asking again now and then.
 */
const UNWATCHED_REFRESH_MS = 60_000

export interface UnreadTotal {
  unread: number
  mentions: number
}

/**
 * Unread counts of every channel of one server. Pass `watched` for the server
 * the live stream follows: its events keep the counts fresh, no polling needed.
 */
export function useWorkspaceUnread(workspaceId: string | undefined, { watched = false } = {}) {
  return useQuery({
    ...listUnreadOptions({ path: { workspaceId: workspaceId ?? '' } }),
    enabled: workspaceId !== undefined,
    refetchInterval: watched ? false : UNWATCHED_REFRESH_MS,
  })
}

/**
 * The badge over every dialogue of this account, hidden ones left out: the
 * server counts them from the same read cursors the sidebar rows show, so the
 * number survives a reload and agrees with what another device just read.
 */
export function useConversationUnreadTotal(): UnreadTotal {
  const { data } = useQuery({
    ...getConversationUnreadOptions(),
    staleTime: 30_000,
  })
  return data ?? { unread: 0, mentions: 0 }
}

/** What a whole server has unread, for its icon in the rail. */
export function totalUnread(channels: readonly ChannelUnread[] | undefined): UnreadTotal {
  let unread = 0
  let mentions = 0
  for (const channel of channels ?? []) {
    unread += channel.unread
    mentions += channel.mentions
  }
  return { unread, mentions }
}

/** «3 непрочитанных, 1 упоминание» — what a badge says to a screen reader. */
export function describeUnread({ unread, mentions }: UnreadTotal): string {
  const parts: string[] = []
  if (unread > 0) {
    parts.push(
      `${String(unread)} ${pluralRu(unread, ['непрочитанное', 'непрочитанных', 'непрочитанных'])}`,
    )
  }
  if (mentions > 0) {
    parts.push(
      `${String(mentions)} ${pluralRu(mentions, ['упоминание', 'упоминания', 'упоминаний'])}`,
    )
  }
  return parts.join(', ')
}

interface ReadOnViewOptions {
  /** Absent in a dialogue; the cursor still moves, there is just no server counter. */
  workspaceId?: string
  channelId: string
  /** The newest message loaded in the channel; undefined while there is none. */
  newestSeq: bigint | undefined
  /** True while the reader can actually see the newest message. */
  viewing: boolean
}

/**
 * Moves the read cursor of a channel up to the newest message while the
 * reader is looking at it, and returns where the cursor stands now.
 *
 * A server channel's answer goes straight into the sidebar counts, so its
 * badge goes out without refetching; other devices of the account hear
 * `read.changed` and refetch theirs. A dialogue has no such counters: its rows
 * and the rail badge are read back from the conversation endpoints, and a move
 * of its cursor refreshes those two queries.
 */
export function useReadOnView({ workspaceId, channelId, newestSeq, viewing }: ReadOnViewOptions) {
  const queryClient = useQueryClient()
  const { data } = useWorkspaceUnread(workspaceId, { watched: true })
  const sentRef = useRef<{ channelId: string; seq: bigint } | undefined>(undefined)
  const { mutate } = useMutation({
    ...markChannelReadMutation(),
    onSuccess: (state) => {
      if (workspaceId === undefined) {
        // A dialogue has no workspace counters: the list rows and the rail
        // badge both carry the server's unread numbers, so refresh both.
        void queryClient.invalidateQueries({ queryKey: listConversationsQueryKey() })
        void queryClient.invalidateQueries({ queryKey: getConversationUnreadQueryKey() })
        return
      }
      queryClient.setQueryData<ChannelUnread[]>(
        listUnreadQueryKey({ path: { workspaceId } }),
        (channels) =>
          channels?.map((channel) => (channel.channelId === state.channelId ? state : channel)),
      )
    },
    onError: () => {
      // Let the next look at the channel try again.
      sentRef.current = undefined
    },
  })

  // A channel created after the counts were fetched has simply never been read.
  // A dialogue has no divider, so its cursor is not needed here.
  const lastReadSeq =
    workspaceId === undefined
      ? 0n
      : data
        ? (data.find((item) => item.channelId === channelId)?.lastReadSeq ?? 0n)
        : undefined

  useEffect(() => {
    if (!viewing || newestSeq === undefined || lastReadSeq === undefined) {
      return
    }
    if (newestSeq <= lastReadSeq) {
      return
    }
    // One request per new message, not one per render while it is in flight.
    const sent = sentRef.current
    if (sent?.channelId === channelId && sent.seq >= newestSeq) {
      return
    }
    sentRef.current = { channelId, seq: newestSeq }
    mutate({ path: { channelId }, body: { seq: newestSeq } })
  }, [viewing, newestSeq, lastReadSeq, channelId, mutate])

  // A dialogue has no divider: everything in it is the unread part on arrival.
  return { lastReadSeq: workspaceId === undefined ? undefined : lastReadSeq }
}

/**
 * «Отметить прочитанным» for one or more channels of a server, from a menu.
 *
 * The server keeps the cursor where it is told and never caps it at the
 * newest message, so a far-ahead `seq` would swallow messages yet to come.
 * Each channel's newest message is therefore read first, and the cursor moves
 * exactly up to it. Channels with nothing unread are skipped.
 */
export function useMarkChannelsRead(workspaceId: string) {
  const queryClient = useQueryClient()
  const { mutateAsync } = useMutation(markChannelReadMutation())

  return useMutation({
    mutationFn: async (channelIds: readonly string[]) => {
      const counts = queryClient.getQueryData<ChannelUnread[]>(
        listUnreadQueryKey({ path: { workspaceId } }),
      )
      const pending = channelIds.filter((channelId) => {
        const state = counts?.find((item) => item.channelId === channelId)
        return state === undefined || state.unread > 0 || state.mentions > 0
      })
      return Promise.all(
        pending.map(async (channelId) => {
          const page = await queryClient.query({
            ...listMessagesOptions({ path: { channelId }, query: { limit: 1 } }),
            staleTime: 0,
          })
          const newest = page.messages[0]
          if (newest === undefined) {
            return undefined
          }
          return mutateAsync({ path: { channelId }, body: { seq: newest.seq } })
        }),
      )
    },
    onSuccess: (states) => {
      queryClient.setQueryData<ChannelUnread[]>(
        listUnreadQueryKey({ path: { workspaceId } }),
        (channels) =>
          channels?.map(
            (channel) => states.find((state) => state?.channelId === channel.channelId) ?? channel,
          ),
      )
    },
  })
}
