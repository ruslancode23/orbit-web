import { useSyncExternalStore } from 'react'

/** What deserves a notification: every message, only those naming me, or nothing. */
export type NotificationMode = 'all' | 'mentions' | 'off'

export const NOTIFICATION_MODES: readonly { value: NotificationMode; label: string }[] = [
  { value: 'all', label: 'Все сообщения' },
  { value: 'mentions', label: 'Только упоминания' },
  { value: 'off', label: 'Выключены' },
]

/** Mentions are what a person usually wants to hear about without being flooded. */
const DEFAULT_MODE: NotificationMode = 'mentions'
// Kept per device, like the permission it goes with: a laptop may want
// everything while a shared screen wants nothing.
const STORAGE_KEY = 'orbit.notifications.mode'

const listeners = new Set<() => void>()
let memoryMode: NotificationMode | undefined

const isMode = (value: unknown): value is NotificationMode =>
  value === 'all' || value === 'mentions' || value === 'off'

export function getNotificationMode(): NotificationMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isMode(stored) ? stored : (memoryMode ?? DEFAULT_MODE)
  } catch {
    // Storage can be off (private mode, blocked cookies): this page still remembers.
    return memoryMode ?? DEFAULT_MODE
  }
}

export function setNotificationMode(mode: NotificationMode): void {
  memoryMode = mode
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Not remembered across reloads; memoryMode keeps it for this page.
  }
  for (const listener of listeners) {
    listener()
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useNotificationMode(): NotificationMode {
  return useSyncExternalStore(subscribe, getNotificationMode, () => DEFAULT_MODE)
}
