import { useSyncExternalStore } from 'react'

/**
 * The profile step is not put away forever by closing it, but it must not
 * come back every time the shell redraws either. The page session remembers
 * which account closed it; a reload or a different account starts clean.
 *
 * The server flag stays the only source of truth about whether the step was
 * *passed*: this memory only says "the person waved it away for now" and
 * lives in memory, never in localStorage.
 */
let closedForUserId: string | null = null

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

/** Hides the step for the rest of this page session, without marking it passed. */
export const closeProfileOnboarding = (userId: string) => {
  closedForUserId = userId
  emit()
}

/** Forgets every dismissal; a test needs this between its cases. */
export const resetProfileOnboarding = () => {
  closedForUserId = null
  emit()
}

/** Whether this account has put the step away in this page session. */
export const useProfileOnboardingClosed = (userId: string | undefined): boolean => {
  return useSyncExternalStore(
    subscribe,
    () => userId !== undefined && closedForUserId === userId,
    () => false,
  )
}
