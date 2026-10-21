import { usePresenceChoice } from '@/entities/live'

/**
 * «Не беспокоить» silences notifications of every kind: messages, secret
 * chats and friendship requests. One predicate keeps the gate in one place
 * instead of every notification spelling out the status check itself.
 *
 * There are no notification sounds in the project yet; a sound added later
 * must read this same value rather than the raw status.
 */
export const useNotificationsMuted = (): boolean => {
  return usePresenceChoice() === 'dnd'
}
