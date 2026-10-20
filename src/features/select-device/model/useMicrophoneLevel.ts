import { createAudioAnalyser, isAudioTrack, Track, type Room } from 'livekit-client'
import { useEffect, useState } from 'react'

/** How often the meter redraws, in milliseconds: often enough to feel live, cheap enough to ignore. */
const SAMPLE_MS = 120

/**
 * How loud the local microphone is right now, 0–1, for the level meter in the
 * device settings. LiveKit holds the microphone track, so its analyser reads
 * exactly what the room hears; without a room there is nothing to measure.
 */
export const useMicrophoneLevel = (room: Room | null): number => {
  const [level, setLevel] = useState(0)
  const isMicrophoneEnabled = room?.localParticipant.isMicrophoneEnabled ?? false

  useEffect(() => {
    if (!room || !isMicrophoneEnabled) {
      return
    }
    const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track
    if (!track || !isAudioTrack(track)) {
      return
    }
    const analyser = createAudioAnalyser(track, { fftSize: 512, smoothingTimeConstant: 0.6 })
    const timer = setInterval(() => {
      setLevel(analyser.calculateVolume())
    }, SAMPLE_MS)
    return () => {
      clearInterval(timer)
      void analyser.cleanup()
    }
  }, [room, isMicrophoneEnabled])

  return isMicrophoneEnabled ? level : 0
}
