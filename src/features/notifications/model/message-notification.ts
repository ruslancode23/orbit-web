import type { LiveEvent } from '@/entities/live'

import type { NotificationMode } from './mode'

/** The part of a `message.created` payload a notification needs. */
export interface IncomingMessage {
  channelId: string
  content: string
  mentions: string[]
  kind?: string
  author?: { id: string; nickname: string }
}

export interface NotifyContext {
  mode: NotificationMode
  myId: string | undefined
  /** The channel on screen, if any. */
  openChannelId: string | undefined
  pageVisible: boolean
  /** «Не беспокоить» silences every notification, whatever the mode says. */
  muted: boolean
}

const MAX_BODY = 140

/**
 * Whether a new message deserves a notification. Never for one's own message,
 * never for the channel the person is looking at; the mode decides the rest.
 */
export function shouldNotify(message: IncomingMessage, context: NotifyContext): boolean {
  if (context.muted || context.mode === 'off' || context.myId === undefined) {
    return false
  }
  if (message.author?.id === context.myId) {
    return false
  }
  if (message.channelId === context.openChannelId && context.pageVisible) {
    return false
  }
  if (context.mode === 'mentions') {
    return message.mentions.includes(context.myId)
  }
  return true
}

/** «Anna: текст», shortened: the notification is a pointer, not the message. */
export function notificationBody(message: IncomingMessage): string {
  const text =
    message.content.length > MAX_BODY
      ? `${message.content.slice(0, MAX_BODY - 1)}…`
      : message.content
  return message.author ? `${message.author.nickname}: ${text}` : text
}

/** Reads a `message.created` event; anything else, or a payload of another shape, gives undefined. */
export function incomingMessage(event: LiveEvent): IncomingMessage | undefined {
  if (event.type !== 'message.created') {
    return undefined
  }
  const payload = event.payload
  if (typeof payload !== 'object' || payload === null) {
    return undefined
  }
  if (!('channelId' in payload) || typeof payload.channelId !== 'string') {
    return undefined
  }
  if (!('content' in payload) || typeof payload.content !== 'string') {
    return undefined
  }
  const mentions =
    'mentions' in payload && Array.isArray(payload.mentions)
      ? payload.mentions.filter((id): id is string => typeof id === 'string')
      : []
  const author = 'author' in payload ? readAuthor(payload.author) : undefined
  const kind = 'kind' in payload && typeof payload.kind === 'string' ? payload.kind : undefined
  return {
    channelId: payload.channelId,
    content: payload.content,
    mentions,
    ...(kind === undefined ? {} : { kind }),
    ...(author ? { author } : {}),
  }
}

function readAuthor(value: unknown): IncomingMessage['author'] {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  if (!('id' in value) || typeof value.id !== 'string') {
    return undefined
  }
  if (!('nickname' in value) || typeof value.nickname !== 'string') {
    return undefined
  }
  return { id: value.id, nickname: value.nickname }
}
