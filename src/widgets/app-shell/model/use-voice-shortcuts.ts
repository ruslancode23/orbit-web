import { useEffect } from 'react'

import { useVoiceRoom } from '@/entities/voice-room'

/**
 * Ctrl+Shift+M mutes, Ctrl+Shift+D deafens — the same pair Discord taught
 * everyone. They work from anywhere in the app, before joining a call too.
 */
export const useVoiceShortcuts = () => {
  const { isMicrophoneMuted, isDeafened, setMicrophoneMuted, setDeafened } = useVoiceRoom()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey) {
        return
      }
      const key = event.key.toLowerCase()
      if (key !== 'm' && key !== 'd') {
        return
      }
      event.preventDefault()
      if (key === 'm') {
        void setMicrophoneMuted(!isMicrophoneMuted)
      } else {
        void setDeafened(!isDeafened)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isMicrophoneMuted, isDeafened, setMicrophoneMuted, setDeafened])
}
