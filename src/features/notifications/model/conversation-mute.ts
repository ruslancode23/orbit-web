import { useSyncExternalStore } from 'react'

/**
 * Dialogues whose notifications are off on this device. There is no server
 * setting for this, so the choice lives in `localStorage` like the notification
 * mode it refines: a phone may want a dialogue silent while a laptop does not.
 */
const STORAGE_KEY = 'orbit.notifications.muted-conversations'

const listeners = new Set<() => void>()
let muted: ReadonlySet<string> = load()

function load(): ReadonlySet<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === null) {
      return new Set()
    }
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      return new Set()
    }
    return new Set(parsed.filter((id): id is string => typeof id === 'string'))
  } catch {
    // Storage can be off (private mode, blocked cookies): this page still works.
    return new Set()
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Whether this dialogue is silent on this device. */
export const isConversationMuted = (conversationId: string): boolean => {
  return muted.has(conversationId)
}

/** Turns the notifications of one dialogue off or on, and stores the choice. */
export const setConversationMuted = (conversationId: string, next: boolean): void => {
  if (muted.has(conversationId) === next) {
    return
  }
  const updated = new Set(muted)
  if (next) {
    updated.add(conversationId)
  } else {
    updated.delete(conversationId)
  }
  muted = updated
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...updated]))
  } catch {
    // Not remembered across reloads; the module keeps it for this page.
  }
  for (const listener of listeners) {
    listener()
  }
}

/** The switch of one dialogue, redrawn when it changes anywhere in the app. */
export const useConversationMuted = (conversationId: string | undefined): boolean => {
  return useSyncExternalStore(
    subscribe,
    () => (conversationId === undefined ? false : isConversationMuted(conversationId)),
    () => false,
  )
}
