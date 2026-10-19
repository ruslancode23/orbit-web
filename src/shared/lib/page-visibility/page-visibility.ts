import { useSyncExternalStore } from 'react'

/** Whether the page is on screen now. A hidden tab is open but nobody is reading it. */
export function isPageVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible'
}

const subscribe = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange)
  return () => {
    document.removeEventListener('visibilitychange', onChange)
  }
}

/** `isPageVisible()` that re-renders when the tab is hidden or shown again. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribe, isPageVisible, () => true)
}
