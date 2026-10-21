import type { IncomingMessage, NotifyContext } from './message-notification'

/** What a direct dialogue adds to the usual notification gate. */
export interface DirectNotifyContext extends Omit<NotifyContext, 'openChannelId'> {
  /** The dialogue on screen, if any; `/me` alone is the list, not a dialogue. */
  openConversationId: string | undefined
  /** The conversation switch in the dialogue menu, kept on this device. */
  conversationMuted: boolean
}

/**
 * Whether a new message in a personal dialogue deserves a notification.
 *
 * A dialogue is not a channel: it has no crowd to be noisy, so every message
 * notifies while notifications are on, whatever the channel mode says. Turning
 * notifications off, «Не беспокоить», the switch of this one dialogue, the
 * reader's own message and the dialogue already on screen still stay quiet.
 */
export const shouldNotifyDirect = (
  message: IncomingMessage,
  context: DirectNotifyContext,
): boolean => {
  if (context.muted || context.mode === 'off' || context.myId === undefined) {
    return false
  }
  if (message.kind === 'system') {
    return false
  }
  if (message.author === undefined || message.author.id === context.myId) {
    return false
  }
  if (context.conversationMuted) {
    return false
  }
  return !(context.pageVisible && message.channelId === context.openConversationId)
}

/** The id of the dialogue the address points at, if it points at one. */
export const conversationIdFromPath = (pathname: string): string | undefined => {
  const match = /^\/me\/([^/]+)$/u.exec(pathname)
  return match?.[1]
}
