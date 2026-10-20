import { useSyncExternalStore } from 'react'

/**
 * On narrow screens the channel column slides over the chat; on wide ones CSS
 * keeps it in place whatever this says. It starts closed everywhere: on a
 * phone the chat is what should be seen first.
 */
let open = false
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

export const useChannelSidebarOpen = (): boolean => {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  )
}

export const setChannelSidebarOpen = (next: boolean): void => {
  open = next
  emit()
}

export const toggleChannelSidebar = (): void => {
  setChannelSidebarOpen(!open)
}
