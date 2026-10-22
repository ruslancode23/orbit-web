import {
  RoomEvent,
  Track,
  type LocalAudioTrack,
  type LocalTrackPublication,
  type Room,
} from 'livekit-client'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  captureConstraints,
  noiseSuppressionMode,
  readAudioProcessing,
  readEnhancedNoiseSuppression,
  saveAudioProcessing,
  saveEnhancedNoiseSuppression,
  type AudioProcessing,
  type NoiseSuppressionMode,
} from './voice-preferences'

/**
 * The browser's processing of the microphone, and RNNoise on top of it. A
 * change goes to the room's capture defaults, so the next microphone LiveKit
 * opens has it, and restarts the one already published: the call goes on, the
 * track is re-acquired with the new constraints on the same device and keeps its mute.
 *
 * RNNoise is a LiveKit track processor, attached to every microphone the room
 * publishes while it is on. If the browser cannot run it (no AudioWorklet, the
 * WASM did not load), the choice falls back to the standard suppression and
 * `enhancedUnavailable` says so.
 */
export function useAudioProcessing(room: Room | null) {
  const [audioProcessing, setState] = useState(readAudioProcessing)
  const [enhanced, setEnhanced] = useState(readEnhancedNoiseSuppression)
  const [enhancedUnavailable, setEnhancedUnavailable] = useState(false)
  // The choice shows at once; RNNoise waits for the restart, or it would sit on the old track.
  const [restarting, setRestarting] = useState(false)

  const captureDefaults = useMemo(
    () => captureConstraints(audioProcessing, enhanced),
    [audioProcessing, enhanced],
  )

  const setAudioProcessing = useCallback(
    async (next: AudioProcessing) => {
      setState(next)
      saveAudioProcessing(next)
      if (room) {
        await restartMicrophone(room, captureConstraints(next, enhanced))
      }
    },
    [room, enhanced],
  )

  const setNoiseSuppressionMode = useCallback(
    async (mode: NoiseSuppressionMode) => {
      const next = { ...audioProcessing, noiseSuppression: mode !== 'off' }
      const withEnhanced = mode === 'enhanced'
      setState(next)
      saveAudioProcessing(next)
      saveEnhancedNoiseSuppression(withEnhanced)
      setEnhancedUnavailable(false)
      setEnhanced(withEnhanced)
      if (!room) {
        return
      }
      setRestarting(true)
      try {
        const track = microphone(room)
        if (track && !withEnhanced && track.getProcessor()) {
          await track.stopProcessor()
        }
        await restartMicrophone(room, captureConstraints(next, withEnhanced))
      } finally {
        setRestarting(false)
      }
    },
    [room, audioProcessing],
  )

  useEffect(() => {
    if (!room || !enhanced || restarting) {
      return
    }
    let active = true
    const attach = (track: LocalAudioTrack | undefined) => {
      if (!track) {
        return
      }
      import('../lib/rnnoise')
        .then(({ attachRnnoise }) => attachRnnoise(track))
        .catch(() => {
          if (!active) {
            return
          }
          // The voice must keep going: back to the browser's own suppression.
          setEnhanced(false)
          saveEnhancedNoiseSuppression(false)
          setEnhancedUnavailable(true)
          void restartMicrophone(room, captureConstraints(audioProcessing, false)).catch(
            () => undefined,
          )
        })
    }
    attach(microphone(room))
    // A microphone published later (unmuting after joining muted, push-to-talk) gets it too.
    const onPublished = (publication: LocalTrackPublication) => {
      if (publication.source === Track.Source.Microphone) {
        attach(publication.audioTrack)
      }
    }
    room.on(RoomEvent.LocalTrackPublished, onPublished)
    return () => {
      active = false
      room.off(RoomEvent.LocalTrackPublished, onPublished)
    }
  }, [room, enhanced, restarting, audioProcessing])

  return {
    audioProcessing,
    captureDefaults,
    noiseSuppressionMode: noiseSuppressionMode(audioProcessing, enhanced),
    enhancedUnavailable,
    setAudioProcessing,
    setNoiseSuppressionMode,
  }
}

const microphone = (room: Room): LocalAudioTrack | undefined => {
  return room.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack
}

/** LiveKit reads its capture defaults each time it opens a microphone, so they can change on a live room. */
const applyToNextMicrophone = (room: Room, constraints: AudioProcessing): void => {
  room.options.audioCaptureDefaults = { ...room.options.audioCaptureDefaults, ...constraints }
}

const restartMicrophone = async (room: Room, constraints: AudioProcessing): Promise<void> => {
  applyToNextMicrophone(room, constraints)
  const track = microphone(room)
  if (!track) {
    return
  }
  const deviceId = room.getActiveDevice('audioinput')
  await track.restartTrack({ ...constraints, ...(deviceId === undefined ? {} : { deviceId }) })
}
