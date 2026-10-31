import { useEffect, useRef, useState } from 'react'

import { useVoiceRoom } from '@/entities/voice-room'
import { usePageVisible } from '@/shared/lib/page-visibility'
import { getPlatform } from '@/shared/platform'

/**
 * Holds the microphone open while the push-to-talk key is down, anywhere in the app.
 *
 * In a browser the tab only sees the keyboard while it has focus: leaving the window lets go at
 * once, because an open microphone nobody watches is the worst outcome. The desktop shell can own
 * the shortcut instead (DESK-6): the key works in any application, and the shell reports both
 * edges. It may also refuse — the chord belongs to another app, or the OS has no such key — and
 * then the page keeps its own listeners rather than losing push-to-talk entirely.
 */
export const usePushToTalk = () => {
  const { inputMode, pushToTalkKey, pressPushToTalk, releasePushToTalk } = useVoiceRoom()
  const visible = usePageVisible()
  const enabled = inputMode === 'push-to-talk'
  const { pushToTalk } = getPlatform()
  const supported = pushToTalk.isSupported()
  // True only once the shell confirmed it owns the key; until then the page listens itself.
  const [owned, setOwned] = useState(false)

  // The shell may fire while the room is reconnecting; the handlers must not re-register the
  // shortcut, so they are read through refs and the registration effect ignores them.
  const press = useRef(pressPushToTalk)
  const release = useRef(releasePushToTalk)
  useEffect(() => {
    press.current = pressPushToTalk
    release.current = releasePushToTalk
  })

  const wanted = enabled && supported

  useEffect(() => {
    if (!wanted) {
      return undefined
    }
    let cancelled = false
    const accelerator = desktopAccelerator(pushToTalkKey)
    void pushToTalk.register(accelerator).then((registered) => {
      if (cancelled) {
        return
      }
      setOwned(registered)
      if (!registered) {
        // The settings screen says what the key is; losing the global chord is worth a warning.
        console.warn(`Orbit: the shortcut ${accelerator} could not be registered`)
      }
    })
    const stop = pushToTalk.onChange((pressed) => {
      if (pressed) {
        press.current()
      } else {
        release.current()
      }
    })
    return () => {
      cancelled = true
      stop()
      setOwned(false)
      void pushToTalk.register(null)
      release.current(true)
    }
  }, [wanted, pushToTalk, pushToTalkKey])

  // The shell may refuse (the chord is taken), and then the page keeps its own listeners.
  const shellOwns = wanted && owned

  // Browser (and the fallback when the shell refused): the key is seen while the tab has focus.
  useEffect(() => {
    if (!enabled || shellOwns) {
      return undefined
    }
    const ours = (event: KeyboardEvent) =>
      event.code === pushToTalkKey && !(event.key.length === 1 && isTypingTarget(event.target))

    const onKeyDown = (event: KeyboardEvent) => {
      if (!ours(event)) {
        return
      }
      // Space would scroll or press the focused button; the backtick would type nowhere useful.
      event.preventDefault()
      if (!event.repeat) {
        pressPushToTalk()
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== pushToTalkKey) {
        return
      }
      if (ours(event)) {
        event.preventDefault()
      }
      releasePushToTalk()
    }
    const onBlur = () => {
      releasePushToTalk(true)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      releasePushToTalk(true)
    }
  }, [enabled, shellOwns, pushToTalkKey, pressPushToTalk, releasePushToTalk])

  useEffect(() => {
    // Hiding the window ends the page's own push-to-talk; the shell's key keeps its own state.
    if (enabled && !visible && !shellOwns) {
      releasePushToTalk(true)
    }
  }, [enabled, visible, shellOwns, releasePushToTalk])
}

/**
 * The settings store the physical key (`KeyboardEvent.code`); a global shortcut needs a modifier,
 * or it would swallow that key in every application. The combination shown to the person is
 * `⌘⇧`/`Ctrl+Shift` plus that key.
 */
const desktopAccelerator = (code: string): string => `CommandOrControl+Shift+${code}`

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) {
    return true
  }
  if (target instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(
      target.type,
    )
  }
  return target instanceof HTMLSelectElement
}
