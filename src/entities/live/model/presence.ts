import { useEffect, useSyncExternalStore } from 'react'

import { isPageVisible } from '@/shared/lib/page-visibility'

import { useLive } from './context'

/** What the account may choose to show. `auto` follows the open tabs. */
export type PresenceChoice = 'auto' | 'online' | 'idle' | 'dnd' | 'invisible'

/** What one tab says about itself: in front and in use, or not. */
export type PresenceActivity = 'active' | 'idle'

/**
 * How long a tab may stay untouched before it says it is idle. The server
 * counts the same five minutes on its side, but sending the frame keeps the
 * other clients in step without waiting for the server's own timer.
 */
export const IDLE_AFTER_MS = 5 * 60 * 1000

const STATUS_KEY = 'orbit.presence.status'
const DEFAULT_STATUS: PresenceChoice = 'auto'

const isPresenceChoice = (value: unknown): value is PresenceChoice =>
  value === 'auto' ||
  value === 'online' ||
  value === 'idle' ||
  value === 'dnd' ||
  value === 'invisible'

/**
 * The status the account picked. It lives on the device as well as in the
 * connection, because the selected status is sent again after a reload and
 * after every reconnect: the server keeps it only in memory.
 */
let memoryStatus: PresenceChoice | undefined

export const getPresenceChoice = (): PresenceChoice => {
  try {
    const stored = localStorage.getItem(STATUS_KEY)
    return isPresenceChoice(stored) ? stored : (memoryStatus ?? DEFAULT_STATUS)
  } catch {
    // Storage can be off (private mode): this page still remembers.
    return memoryStatus ?? DEFAULT_STATUS
  }
}

const statusListeners = new Set<() => void>()

export const setPresenceChoice = (choice: PresenceChoice): void => {
  memoryStatus = choice
  try {
    localStorage.setItem(STATUS_KEY, choice)
  } catch {
    // Not remembered across reloads; memoryStatus keeps it for this page.
  }
  for (const listener of statusListeners) {
    listener()
  }
}

const subscribeStatus = (listener: () => void) => {
  statusListeners.add(listener)
  return () => {
    statusListeners.delete(listener)
  }
}

/** The chosen status, kept in step across the panel and the notification gates. */
export const usePresenceChoice = (): PresenceChoice => {
  return useSyncExternalStore(subscribeStatus, getPresenceChoice, () => DEFAULT_STATUS)
}

let currentActivity: PresenceActivity = 'active'
const activityListeners = new Set<() => void>()

const publishActivity = (activity: PresenceActivity): void => {
  if (currentActivity === activity) {
    return
  }
  currentActivity = activity
  for (const listener of activityListeners) {
    listener()
  }
}

const subscribeActivity = (listener: () => void) => {
  activityListeners.add(listener)
  return () => {
    activityListeners.delete(listener)
  }
}

/** What this tab last told the server; the status menu echoes it for `auto`. */
export const usePresenceActivityState = (): PresenceActivity => {
  return useSyncExternalStore(
    subscribeActivity,
    () => currentActivity,
    () => 'active',
  )
}

/**
 * Chooses a status and tells the live stream at once. The connection keeps the
 * last frame, so a reconnect sends it again without the caller doing anything.
 */
export const useMyStatus = (): {
  status: PresenceChoice
  choose: (status: PresenceChoice) => void
} => {
  const { setStatus } = useLive()
  const status = usePresenceChoice()

  const choose = (next: PresenceChoice) => {
    setPresenceChoice(next)
    setStatus(next)
  }

  return { status, choose }
}

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const

/**
 * Keeps the tab's activity in step with the live stream: hidden means idle,
 * five minutes without input means idle, and the first input after that means
 * active again. The frames are tiny and only go out when the value changes.
 */
export const usePresenceActivity = (): void => {
  const { setActivity } = useLive()

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let current: PresenceActivity | undefined

    const notify = (next: PresenceActivity) => {
      if (current === next) {
        return
      }
      current = next
      publishActivity(next)
      setActivity(next)
    }

    const clearIdleTimer = () => {
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
    }

    const scheduleIdle = () => {
      clearIdleTimer()
      timer = setTimeout(() => {
        if (isPageVisible()) {
          notify('idle')
        }
      }, IDLE_AFTER_MS)
    }

    const becomeActive = () => {
      notify('active')
      scheduleIdle()
    }

    const handleVisibility = () => {
      if (isPageVisible()) {
        becomeActive()
      } else {
        clearIdleTimer()
        notify('idle')
      }
    }

    // Any input only counts while the tab is in front; a hidden tab stays idle
    // whatever the OS sends to it.
    const handleInput = () => {
      if (isPageVisible()) {
        becomeActive()
      }
    }

    if (isPageVisible()) {
      becomeActive()
    } else {
      notify('idle')
    }

    document.addEventListener('visibilitychange', handleVisibility)
    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, handleInput, { passive: true })
    }

    return () => {
      clearIdleTimer()
      document.removeEventListener('visibilitychange', handleVisibility)
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, handleInput)
      }
    }
  }, [setActivity])
}
