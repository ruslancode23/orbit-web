import type { Friend, PresenceStatus } from '@/shared/api'
import { pluralRu } from '@/shared/lib/plural'

/**
 * Presence values that mean the person can be reached now. `dnd` is still
 * here on purpose: the server has already applied the account's privacy, so
 * "do not disturb" is visible and can still receive a message.
 */
const ONLINE_PRESENCE: readonly PresenceStatus[] = ['online', 'idle', 'dnd']

/** Whether a friend belongs to the «В сети» tab. */
export const isFriendOnline = (friend: Friend): boolean => {
  return ONLINE_PRESENCE.includes(friend.presence)
}

/** «1 входящая заявка», «2 входящие заявки», «5 входящих заявок». */
export const describeIncomingRequests = (count: number): string => {
  return `${String(count)} ${pluralRu(count, [
    'входящая заявка',
    'входящие заявки',
    'входящих заявок',
  ])}`
}

/** What a person wrote about themselves, emoji included, or an empty string. */
export const customStatusText = (
  profile:
    | {
        customStatus?: {
          emoji?: string
          text?: string
        }
      }
    | undefined,
): string => {
  const status = profile?.customStatus
  if (!status) {
    return ''
  }
  return [status.emoji, status.text]
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .join(' ')
}

/** A short day for a request or a block; the list around it gives the year. */
export const formatFriendDate = (date: Date): string => {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date)
}
