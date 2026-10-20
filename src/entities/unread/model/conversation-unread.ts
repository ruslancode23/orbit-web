import { useSyncExternalStore } from 'react'

/** How much of one dialogue is unread, with mentions counted apart. */
export interface ConversationUnread {
  unread: number
  mentions: number
}

/** What a dialogue without a badge holds; one object, so snapshots stay stable. */
export const EMPTY_CONVERSATION_UNREAD: ConversationUnread = { unread: 0, mentions: 0 }

type Entries = readonly (readonly [string, ConversationUnread])[]

/**
 * Unread counts of dialogues.
 *
 * The current server contract has no per-conversation counters yet (DM-2), so
 * this is fed by the personal live stream: a message that arrives while its
 * dialogue is not being read raises the count, and `read.changed` — from this
 * tab or another one — puts the server's exact number back. It is deliberately
 * a small external store instead of a second copy of a query: there is no
 * query to read the counters from, and when one appears this module is what
 * changes.
 */
let counts: ReadonlyMap<string, ConversationUnread> = new Map()
let entries: Entries = []
/** The newest message seen per dialogue, so a replay after a reconnect is not counted twice. */
const seenSeq = new Map<string, number>()
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getEntries = () => entries

const commit = (next: Map<string, ConversationUnread>) => {
  counts = next
  entries = [...next.entries()]
  for (const listener of listeners) {
    listener()
  }
}

/** Forgets every count, for example when the signed-in account changes. */
export const resetConversationUnread = () => {
  if (counts.size === 0 && seenSeq.size === 0) {
    return
  }
  seenSeq.clear()
  commit(new Map())
}

/** Replaces the count of one dialogue with the number the server reported. */
export const setConversationUnread = (channelId: string, next: ConversationUnread) => {
  const previous = counts.get(channelId)
  if (previous?.unread === next.unread && previous.mentions === next.mentions) {
    return
  }
  const updated = new Map(counts)
  if (next.unread === 0 && next.mentions === 0) {
    updated.delete(channelId)
  } else {
    updated.set(channelId, next)
  }
  commit(updated)
}

/** Remembers how far this client has seen, so replayed events are skipped. */
export const noteConversationSeq = (channelId: string, seq: number) => {
  if (!Number.isFinite(seq) || seq <= (seenSeq.get(channelId) ?? -1)) {
    return
  }
  seenSeq.set(channelId, seq)
}

/** One new message in a dialogue that is not being read right now. */
export const countConversationMessage = (
  channelId: string,
  seq: number | undefined,
  mentioned: boolean,
) => {
  if (seq !== undefined) {
    if (seq <= (seenSeq.get(channelId) ?? -1)) {
      return
    }
    noteConversationSeq(channelId, seq)
  }
  const previous = counts.get(channelId) ?? EMPTY_CONVERSATION_UNREAD
  setConversationUnread(channelId, {
    unread: previous.unread + 1,
    mentions: previous.mentions + (mentioned ? 1 : 0),
  })
}

/** The dialogue was read up to the cursor the server answered with. */
export const markConversationRead = (
  channelId: string,
  state: { unread: number; mentions: number; lastReadSeq: number },
) => {
  noteConversationSeq(channelId, state.lastReadSeq)
  setConversationUnread(channelId, { unread: state.unread, mentions: state.mentions })
}

/** One dialogue's count; components subscribe to just this row. */
export const useConversationUnread = (channelId: string): ConversationUnread => {
  return useSyncExternalStore(
    subscribe,
    () => counts.get(channelId) ?? EMPTY_CONVERSATION_UNREAD,
    () => EMPTY_CONVERSATION_UNREAD,
  )
}

/** All counts together, for the rail badge. */
export const useConversationUnreadTotal = (): ConversationUnread => {
  // `entries` is replaced only when a count changes, so the snapshot is stable.
  useSyncExternalStore(subscribe, getEntries, getEntries)
  let unread = 0
  let mentions = 0
  for (const [, value] of entries) {
    unread += value.unread
    mentions += value.mentions
  }
  return { unread, mentions }
}
