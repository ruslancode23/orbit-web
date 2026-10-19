import { createContext, use } from 'react'

import type { LiveStatus } from './connection'

export interface LiveValue {
  status: LiveStatus
  /** Watch one server; calling it again switches servers on the same socket. */
  watch: (workspaceId: string) => void
}

export const LiveContext = createContext<LiveValue | null>(null)

/** The app's live connection. Available inside LiveProvider. */
export function useLive(): LiveValue {
  const value = use(LiveContext)
  if (!value) throw new Error('useLive must be used inside LiveProvider')
  return value
}
