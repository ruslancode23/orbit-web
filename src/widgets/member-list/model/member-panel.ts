import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'orbit.members.open'

const readOpen = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
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
