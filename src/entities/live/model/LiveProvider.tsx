import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { listMessagesQueryKey, listUnreadQueryKey } from '@/shared/api'

import { LiveConnection, type LiveEvent, type LiveStatus } from './connection'
import { LiveContext, type LiveValue } from './context'

/**
 * Holds the app's single live connection. It lives above the routes, so moving
 * between channels and servers never opens a second socket.
 */
interface LiveProviderProps {
  children: ReactNode
  /**
   * Whether there is a session to stream with. The stream needs the session
   * cookie, so opening it before anyone signed in would only collect 401s.
   */
  enabled: boolean
}

export function LiveProvider({ children, enabled }: LiveProviderProps) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<LiveStatus>('connecting')
  const connectionRef = useRef<LiveConnection | null>(null)
  const watchedRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!enabled) return undefined

    const connection = new LiveConnection({
      onStatus: setStatus,
      onEvent: (event) => {
        applyEvent(queryClient, event)
      },
    })
    connectionRef.current = connection
    connection.open()
    // Re-watch what this session was watching before a remount.
    if (watchedRef.current) connection.subscribe(watchedRef.current)

    return () => {
      connection.close()
      connectionRef.current = null
    }
  }, [queryClient, enabled])

  const value = useMemo<LiveValue>(
    () => ({
      status,
      watch: (workspaceId: string) => {
        if (watchedRef.current === workspaceId) return
        watchedRef.current = workspaceId
        connectionRef.current?.subscribe(workspaceId)
      },
    }),
    [status],
  )

  return <LiveContext value={value}>{children}</LiveContext>
}

/**
 * Turns an event into "this is out of date": the data itself comes from the
 * API, so there is one source of truth and no second copy to keep in step.
 */
function applyEvent(queryClient: ReturnType<typeof useQueryClient>, event: LiveEvent) {
  if (event.type.startsWith('message.') && event.channelId) {
    void queryClient.invalidateQueries({
      queryKey: listMessagesQueryKey({ path: { channelId: event.channelId } }),
    })
  }
  if (event.workspaceId && (event.type.startsWith('message.') || event.type === 'read.changed')) {
    void queryClient.invalidateQueries({
      queryKey: listUnreadQueryKey({ path: { workspaceId: event.workspaceId } }),
    })
  }
  // Someone joined, left, was banned or changed role: the member list and the
  // servers we are on may both have changed.
  if (event.type === 'member.changed') {
    void queryClient.invalidateQueries()
  }
}
