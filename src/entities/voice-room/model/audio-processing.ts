import { Track, type Room } from 'livekit-client'
import { useCallback, useState } from 'react'

import { readAudioProcessing, saveAudioProcessing, type AudioProcessing } from './voice-preferences'

/**
 * The browser's processing of the microphone. A change goes to the room's
 * capture defaults, so the next microphone LiveKit opens has it, and restarts
 * the one already published: the call goes on, the track is re-acquired with
 * the new constraints on the same device and keeps its mute.
 */
export function useAudioProcessing(room: Room | null) {
  const [audioProcessing, setState] = useState(readAudioProcessing)

  const setAudioProcessing = useCallback(
    async (next: AudioProcessing) => {
      setState(next)
      saveAudioProcessing(next)
      if (!room) {
        return
      }
      applyToNextMicrophone(room, next)
      const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack
      if (!track) {
        return
      }
      const deviceId = room.getActiveDevice('audioinput')
      await track.restartTrack({ ...next, ...(deviceId === undefined ? {} : { deviceId }) })
    },
    [room],
  )

  return { audioProcessing, setAudioProcessing }
}

/** LiveKit reads its capture defaults each time it opens a microphone, so they can change on a live room. */
const applyToNextMicrophone = (room: Room, processing: AudioProcessing): void => {
  room.options.audioCaptureDefaults = { ...room.options.audioCaptureDefaults, ...processing }
}
