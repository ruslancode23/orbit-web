import { useEffect } from 'react'

import { useVoiceRoom } from '@/entities/voice-room'
import { usePageVisible } from '@/shared/lib/page-visibility'

/**
 * Holds the microphone open while the push-to-talk key is down, anywhere in
 * the app. A key that types a character still types it in a text field, so a
 * message can mention «`»; modifier and function keys work while typing too.
 * Leaving the window or the tab lets go at once: the browser would not tell us
 * about the key coming up there, and an open microphone nobody watches is the
 * worst outcome. Outside the tab the key is not seen at all — that needs the desktop app.
 */
export const usePushToTalk = () => {
  const { inputMode, pushToTalkKey, pressPushToTalk, releasePushToTalk } = useVoiceRoom()
  const visible = usePageVisible()
  const enabled = inputMode === 'push-to-talk'

  useEffect(() => {
    if (!enabled) {
      return
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
  }, [enabled, pushToTalkKey, pressPushToTalk, releasePushToTalk])

  useEffect(() => {
    if (enabled && !visible) {
      releasePushToTalk(true)
    }
  }, [enabled, visible, releasePushToTalk])
}

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
