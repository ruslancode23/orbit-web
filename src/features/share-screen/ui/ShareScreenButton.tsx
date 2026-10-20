import { useState } from 'react'

import { useVoiceRoom } from '@/entities/voice-room'
import { getPlatform, type ScreenCapture } from '@/shared/platform'
import { ScreenIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'

import type { Room } from 'livekit-client'

/** Starts or stops showing a window or the whole screen, with system audio where the browser allows it. */
export const ShareScreenButton = () => {
  const { room, isSharingScreen } = useVoiceRoom()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!room) {
    return null
  }

  const toggle = async () => {
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
    <div className="flex flex-col gap-1">
      <IconButton
        label={isSharingScreen ? 'Остановить показ' : 'Показать экран'}
        variant={isSharingScreen ? 'danger' : 'ghost'}
        pressed={isSharingScreen}
        disabled={pending}
        onClick={() => void toggle()}
      >
        <ScreenIcon />
      </IconButton>
      {error && (
        <p role="alert" className="text-xs text-danger">
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
const publishScreen = async (room: Room, { video, audio }: ScreenCapture) => {
  // LiveKit is already loaded by the time a room exists; importing it here keeps
  // the initial text-only bundle free of it.
  const { Track } = await import('livekit-client')
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

const describeShareError = (cause: unknown): string | null => {
  // Closing the browser's picker is a choice, not an error.
  if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
    return null
  }
  if (cause instanceof DOMException && cause.name === 'NotSupportedError') {
    return 'Этот браузер не умеет показывать экран.'
  }
  return 'Не удалось начать показ экрана.'
}
