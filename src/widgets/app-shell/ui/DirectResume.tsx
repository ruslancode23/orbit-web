import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'

import { useConversationSummaries } from '@/entities/conversation'
import { useLive } from '@/entities/live'
import { listConversationsQueryKey } from '@/shared/api'

/**
 * Catches up the personal stream from where the newest loaded messages stand.
 * The connection keeps the cursors and repeats them after a reconnect, so the
 * frame is sent only when they actually change; it is mounted with the
 * personal-messages section, which is where those messages are known.
 */
export const DirectResume = () => {
  const { summaries } = useConversationSummaries()
  const { resume, status } = useLive()
  const queryClient = useQueryClient()
  const wasDisconnectedRef = useRef(false)
  const cursors = useMemo(() => {
    const next: Record<string, number> = {}
    for (const summary of summaries) {
      if (summary.lastMessage) {
        next[summary.conversation.id] = Number(summary.lastMessage.seq)
      }
    }
    return next
  }, [summaries])
  const cursorKey = JSON.stringify(cursors)
  const sentCursorsRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (sentCursorsRef.current === cursorKey) {
      return
    }
    sentCursorsRef.current = cursorKey
    resume(cursors)
  }, [cursorKey, cursors, resume])

  // A dialogue opened while this device was offline is not part of the replay:
  // the server replays messages, not conversations. Ask for the list again.
  useEffect(() => {
    if (status === 'reconnecting' || status === 'offline') {
      wasDisconnectedRef.current = true
      return
    }
    if (status === 'open' && wasDisconnectedRef.current) {
      wasDisconnectedRef.current = false
      void queryClient.invalidateQueries({ queryKey: listConversationsQueryKey() })
    }
  }, [status, queryClient])

  return null
}
