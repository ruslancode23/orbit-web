import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { isPageVisible } from '@/shared/lib/page-visibility'

import { applyEvent, refreshAfterGap } from './apply-event'
import { LiveConnection, type LiveStatus } from './connection'
import { LiveContext, type LiveListener, type LiveValue } from './context'
import { getPresenceChoice, type PresenceActivity, type PresenceChoice } from './presence'

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
  const conversationsRef = useRef<Record<string, number> | undefined>(undefined)
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
      onReconnect: () => {
        refreshAfterGap(queryClient)
      },
    })
    connectionRef.current = connection
    // The socket is not open yet, so `resume` would be dropped: the frame is
    // kept here and sent when it comes up, and after every reconnect by the
    // connection itself.
    if (conversationsRef.current) {
      connection.resume(conversationsRef.current)
    }
    // Presence lives in the server's memory, so every fresh socket starts with
    // what this device had chosen and how this tab started.
    connection.setStatus(getPresenceChoice())
    connection.setActivity(isPageVisible() ? 'active' : 'idle')
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

  const watch = useCallback((workspaceId: string) => {
    if (watchedRef.current === workspaceId) {
      return
    }
    watchedRef.current = workspaceId
    connectionRef.current?.subscribe(workspaceId)
  }, [])

  const resume = useCallback((conversations: Record<string, number>) => {
    conversationsRef.current = conversations
    connectionRef.current?.resume(conversations)
  }, [])

  const listen = useCallback((listener: LiveListener) => {
    const listeners = listenersRef.current
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const setPresence = useCallback((next: PresenceChoice) => {
    connectionRef.current?.setStatus(next)
  }, [])

  const setActivity = useCallback((activity: PresenceActivity) => {
    connectionRef.current?.setActivity(activity)
  }, [])

  const value = useMemo<LiveValue>(
    () => ({
      status,
      watch,
      resume,
      setStatus: setPresence,
      setActivity,
      listen,
    }),
    [status, watch, resume, setPresence, setActivity, listen],
  )

  return <LiveContext value={value}>{children}</LiveContext>
}
