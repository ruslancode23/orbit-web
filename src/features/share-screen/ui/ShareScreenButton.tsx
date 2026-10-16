import { Track, type Room } from 'livekit-client'
import { useState } from 'react'

import { useVoiceRoom } from '@/entities/voice-room'
import { getPlatform, type ScreenCapture } from '@/shared/platform'
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
      if (isSharingScreen) {
        // Unpublishes and stops the screen and its audio at once, so nothing more is sent.
        await room.localParticipant.setScreenShareEnabled(false)
      } else {
        await publishScreen(room, await getPlatform().screenCapture.capture({ audio: true }))
      }
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

/**
 * Publishes a capture as the screen share. LiveKit unpublishes a screen track when it ends,
 * so the OS "Stop sharing" button keeps working for tracks the adapter captured.
 */
async function publishScreen(room: Room, { video, audio }: ScreenCapture) {
  try {
    await room.localParticipant.publishTrack(video, { source: Track.Source.ScreenShare })
    if (audio) {
      await room.localParticipant.publishTrack(audio, { source: Track.Source.ScreenShareAudio })
    }
  } catch (cause) {
    // Half a share is worse than none: take back what was published and free the capture.
    await room.localParticipant.setScreenShareEnabled(false)
    video.stop()
    audio?.stop()
    throw cause
  }
}

function describeShareError(cause: unknown): string | null {
  // Closing the browser's picker is a choice, not an error.
  if (cause instanceof DOMException && cause.name === 'NotAllowedError') return null
  if (cause instanceof DOMException && cause.name === 'NotSupportedError') {
    return 'Этот браузер не умеет показывать экран.'
  }
  return 'Не удалось начать показ экрана.'
}
