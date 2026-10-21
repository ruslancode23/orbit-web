import { useSyncExternalStore } from 'react'

/** Whether friendship requests may raise a system notification at all. */
const STORAGE_KEY = 'orbit.notifications.friends'
const DEFAULT_ENABLED = true

let memoryEnabled: boolean | undefined

export const getFriendNotificationsEnabled = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'on') {
      return true
    }
    if (stored === 'off') {
      return false
    }
    return memoryEnabled ?? DEFAULT_ENABLED
  } catch {
    // Storage can be off (private mode): this page still remembers.
    return memoryEnabled ?? DEFAULT_ENABLED
  }
}

const listeners = new Set<() => void>()

export const setFriendNotificationsEnabled = (enabled: boolean): void => {
  memoryEnabled = enabled
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // Not remembered across reloads; memoryEnabled keeps it for this page.
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

export const useFriendNotificationsEnabled = (): boolean => {
  return useSyncExternalStore(subscribe, getFriendNotificationsEnabled, () => DEFAULT_ENABLED)
}
