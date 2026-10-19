import { createContext, use } from 'react'

import type { LiveEvent, LiveStatus } from './connection'

export type LiveListener = (event: LiveEvent) => void

export interface LiveValue {
  status: LiveStatus
  /** Watch one server; calling it again switches servers on the same socket. */
  watch: (workspaceId: string) => void
  /**
   * Hears every event after the cache has been told about it. For reactions
   * that are not data — a notification — never for keeping a second copy.
   * Returns the unsubscribe function.
   */
  listen: (listener: LiveListener) => () => void
}

export const LiveContext = createContext<LiveValue | null>(null)

/** The app's live connection. Available inside LiveProvider. */
export function useLive(): LiveValue {
  const value = use(LiveContext)
  if (!value) {
    throw new Error('useLive must be used inside LiveProvider')
  }
  return value
}
