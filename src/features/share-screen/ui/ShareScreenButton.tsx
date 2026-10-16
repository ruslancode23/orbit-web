import { useState } from 'react'

import { useVoiceRoom } from '@/entities/voice-room'
import { Button } from '@/shared/ui/button'

/** Starts or stops showing a window or the whole screen, with system audio where the browser allows it. */
export function ShareScreenButton() {
  const { room, isSharingScreen } = useVoiceRoom()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!room) return null

  async function toggle() {
    if (!room) return
    setPending(true)
    setError(null)
    try {
      // Stopping unpublishes and stops the track at once, so nothing more is sent.
      await room.localParticipant.setScreenShareEnabled(!isSharingScreen, { audio: true })
    } catch (cause) {
      setError(describeShareError(cause))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={isSharingScreen ? 'secondary' : 'primary'}
        aria-pressed={isSharingScreen}
        disabled={pending}
        onClick={() => void toggle()}
      >
        {isSharingScreen ? 'Остановить показ' : 'Показать экран'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function describeShareError(cause: unknown): string | null {
  // Closing the browser's picker is a choice, not an error.
  if (cause instanceof DOMException && cause.name === 'NotAllowedError') return null
  if (cause instanceof DOMException && cause.name === 'NotSupportedError') {
    return 'Этот браузер не умеет показывать экран.'
  }
  return 'Не удалось начать показ экрана.'
}
