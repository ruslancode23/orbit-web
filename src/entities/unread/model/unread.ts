import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import {
  type ChannelUnread,
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
  workspaceId: string
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
 * The answer goes straight into the sidebar counts, so the badge goes out
 * without refetching; other devices of the account hear `read.changed` from
 * the server and refetch theirs.
 */
export function useReadOnView({ workspaceId, channelId, newestSeq, viewing }: ReadOnViewOptions) {
  const queryClient = useQueryClient()
  const { data } = useWorkspaceUnread(workspaceId, { watched: true })
  const sentRef = useRef<{ channelId: string; seq: bigint } | undefined>(undefined)
  const { mutate } = useMutation({
    ...markChannelReadMutation(),
    onSuccess: (state) => {
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
  const lastReadSeq = data
    ? (data.find((item) => item.channelId === channelId)?.lastReadSeq ?? 0n)
    : undefined

  useEffect(() => {
    if (!viewing || newestSeq === undefined || lastReadSeq === undefined) return
    if (newestSeq <= lastReadSeq) return
    // One request per new message, not one per render while it is in flight.
    const sent = sentRef.current
    if (sent?.channelId === channelId && sent.seq >= newestSeq) return
    sentRef.current = { channelId, seq: newestSeq }
    mutate({ path: { channelId }, body: { seq: newestSeq } })
  }, [viewing, newestSeq, lastReadSeq, channelId, mutate])

  return { lastReadSeq }
}
