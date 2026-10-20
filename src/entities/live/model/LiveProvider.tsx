import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { applyEvent } from './apply-event'
import { LiveConnection, type LiveStatus } from './connection'
import { LiveContext, type LiveListener, type LiveValue } from './context'

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

export const LiveProvider = ({ children, enabled }: LiveProviderProps) => {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<LiveStatus>('connecting')
  const connectionRef = useRef<LiveConnection | null>(null)
  const watchedRef = useRef<string | undefined>(undefined)
  const listenersRef = useRef(new Set<LiveListener>())

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    const connection = new LiveConnection({
      onStatus: setStatus,
      onEvent: (event) => {
        applyEvent(queryClient, event)
        for (const listener of listenersRef.current) {
          listener(event)
        }
      },
    })
    connectionRef.current = connection
    connection.open()
    // Re-watch what this session was watching before a remount.
    if (watchedRef.current) {
      connection.subscribe(watchedRef.current)
    }

    return () => {
      connection.close()
      connectionRef.current = null
    }
  }, [queryClient, enabled])

  const value = useMemo<LiveValue>(
    () => ({
      status,
      watch: (workspaceId: string) => {
        if (watchedRef.current === workspaceId) {
          return
        }
        watchedRef.current = workspaceId
        connectionRef.current?.subscribe(workspaceId)
      },
      resume: (conversations: Record<string, number>) => {
        connectionRef.current?.resume(conversations)
      },
      listen: (listener: LiveListener) => {
        const listeners = listenersRef.current
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    }),
    [status],
  )

  return <LiveContext value={value}>{children}</LiveContext>
}
