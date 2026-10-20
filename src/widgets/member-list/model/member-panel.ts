import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'orbit.members.open'

/**
 * Wide screens show the members by default; a phone starts with the chat and
 * opens the column when asked. A choice once made on this device wins.
 */
const readOpen = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      return stored !== 'false'
    }
  } catch {
    // Storage blocked: fall through to the screen size.
  }
  if (typeof window.matchMedia !== 'function') {
    return true
  }
  return window.matchMedia('(min-width: 1024px)').matches
}

let open = readOpen()
const listeners = new Set<() => void>()

const emit = () => {
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

/** Whether the member column is showing; the choice is remembered on this device. */
export const useMemberPanelOpen = (): boolean => {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => true,
  )
}

export const setMemberPanelOpen = (next: boolean): void => {
  open = next
  try {
    localStorage.setItem(STORAGE_KEY, String(next))
  } catch {
    // The panel still opens; it just is not remembered.
  }
  emit()
}

export const toggleMemberPanel = (): void => {
  setMemberPanelOpen(!open)
}
