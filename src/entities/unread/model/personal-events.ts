import { countConversationMessage, markConversationRead } from './conversation-unread'

/** The part of a live frame this module reads; `LiveEvent` fits it. */
export interface PersonalEvent {
  type: string
  workspaceId?: string
  channelId?: string
  seq?: number
  payload?: unknown
}

export interface PersonalEventContext {
  /** The signed-in account; its own messages are never unread. */
  userId: string | undefined
  /** The dialogue on screen, when there is one. */
  openChannelId: string | undefined
  /** Whether this tab is actually being read right now. */
  viewing: boolean
}

const readField = (value: object, key: string): unknown => {
  return Object.getOwnPropertyDescriptor(value, key)?.value
}

const readString = (value: object, key: string): string | undefined => {
  const field = readField(value, key)
  return typeof field === 'string' ? field : undefined
}

const readNumber = (value: object, key: string): number | undefined => {
  const field = readField(value, key)
  return typeof field === 'number' && Number.isFinite(field) ? field : undefined
}

const asObject = (value: unknown): object | undefined => {
  return typeof value === 'object' && value !== null ? value : undefined
}

/**
 * Applies one personal-stream event to the dialogue counters.
 *
 * A personal event has no server id: a dialogue is a channel without one, so
 * `workspaceId` being absent is what tells it apart from a channel event on
 * the same socket. `read.changed` carries the server's exact count, which is
 * how another tab clears the badge here; `message.created` carries the whole
 * message, so no refetch is needed to raise it.
 */
export const applyPersonalEvent = (event: PersonalEvent, context: PersonalEventContext): void => {
  if (event.workspaceId !== undefined || event.channelId === undefined) {
    return
  }
  if (event.type === 'read.changed') {
    const payload = asObject(event.payload)
    if (!payload) {
      return
    }
    const unread = readNumber(payload, 'unread')
    const mentions = readNumber(payload, 'mentions')
    const lastReadSeq = readNumber(payload, 'lastReadSeq')
    if (unread === undefined || mentions === undefined) {
      return
    }
    markConversationRead(event.channelId, {
      unread,
      mentions,
      lastReadSeq: lastReadSeq ?? 0,
    })
    return
  }
  if (event.type !== 'message.created') {
    return
  }
  // Reading a dialogue marks it read; its own live messages must not flash a badge.
  if (context.viewing && context.openChannelId === event.channelId) {
    return
  }
  const payload = asObject(event.payload)
  if (!payload) {
    return
  }
  const author = asObject(readField(payload, 'author'))
  if (author && context.userId !== undefined && readString(author, 'id') === context.userId) {
    return
  }
  const rawMentions = readField(payload, 'mentions')
  const mentioned =
    context.userId !== undefined &&
    Array.isArray(rawMentions) &&
    rawMentions.some((mentionedId) => mentionedId === context.userId)
  countConversationMessage(event.channelId, event.seq, mentioned)
}
