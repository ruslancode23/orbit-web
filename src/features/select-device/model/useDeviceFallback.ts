import { useEffect, useRef } from 'react'

import { useToast } from '@/shared/ui/toast'

import type { Room } from 'livekit-client'

interface DeviceFallbackParams {
  /** The remembered device, if any. */
  id: string | undefined
  /** Whether that device is in the list right now. */
  present: boolean
  /** Whether the list is trustworthy — labels are hidden before microphone access. */
  ready: boolean
  room: Room | null
  kind: 'audioinput' | 'audiooutput'
  missingMessage: string
}

/**
 * Keeps a remembered device honest: says so once when it disappears, and puts
 * the room back on it when it returns. The id itself is never forgotten, so
 * plugging the headphones back in is enough.
 */
export const useDeviceFallback = ({
  id,
  present,
  ready,
  room,
  kind,
  missingMessage,
}: DeviceFallbackParams) => {
  const toast = useToast()
  const reportedRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!ready || id === undefined) {
      return
    }
    if (present) {
      reportedRef.current = undefined
      return
    }
    if (reportedRef.current === id) {
      return
    }
    reportedRef.current = id
    toast(missingMessage, 'danger')
  }, [ready, id, present, missingMessage, toast])

  useEffect(() => {
    if (!ready || !present || id === undefined || !room) {
      return
    }
    void room.switchActiveDevice(kind, id)
  }, [ready, present, id, room, kind])
}
