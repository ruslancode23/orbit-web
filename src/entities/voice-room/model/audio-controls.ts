import { RoomEvent, Track, type RemoteParticipant, type Room } from 'livekit-client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { VoiceParticipant } from './context'

/** Participant attribute other clients read to show that someone hears nobody. */
export const DEAFENED_ATTRIBUTE = 'deafened'

/**
 * Mute, deafen and per-participant volume for the connected room.
 * Deafen is local playback at zero plus the `deafened` attribute, so others can see it.
 */
export function useAudioControls(room: Room | null) {
  const [isDeafened, setIsDeafened] = useState(false)
  const [volumes, setVolumes] = useState<ReadonlyMap<string, number>>(new Map())
  const [stateRoom, setStateRoom] = useState(room)
  const mutedBeforeDeafenRef = useRef(false)

  // A new room (or leaving) starts with everyone audible.
  if (room !== stateRoom) {
    setStateRoom(room)
    setIsDeafened(false)
    setVolumes(new Map())
  }

  // LiveKit keeps the volume per participant and applies it to tracks subscribed later.
  useEffect(() => {
    if (!room) {
      return
    }
    const apply = (participant: RemoteParticipant) => {
      const volume = isDeafened ? 0 : (volumes.get(participant.identity) ?? 1)
      participant.setVolume(volume, Track.Source.Microphone)
      participant.setVolume(isDeafened ? 0 : 1, Track.Source.ScreenShareAudio)
    }
    for (const participant of room.remoteParticipants.values()) {
      apply(participant)
    }
    room.on(RoomEvent.ParticipantConnected, apply)
    return () => {
      room.off(RoomEvent.ParticipantConnected, apply)
    }
  }, [room, isDeafened, volumes])

  useEffect(() => {
    if (!room) {
      return
    }
    const publish = () => {
      const { localParticipant } = room
      const published = localParticipant.attributes[DEAFENED_ATTRIBUTE] === 'true'
      if (published === isDeafened) {
        return
      }
      // Without the permission in the token others just do not see it; local deafen still works.
      localParticipant
        .setAttributes({ [DEAFENED_ATTRIBUTE]: String(isDeafened) })
        .catch(() => undefined)
    }
    publish()
    // A full reconnect is a new session on the server, without the attributes.
    room.on(RoomEvent.Reconnected, publish)
    return () => {
      room.off(RoomEvent.Reconnected, publish)
    }
  }, [room, isDeafened])

  const setDeafened = useCallback(
    async (deafened: boolean) => {
      if (!room) {
        return
      }
      const { localParticipant } = room
      setIsDeafened(deafened)
      if (deafened) {
        mutedBeforeDeafenRef.current = !localParticipant.isMicrophoneEnabled
        await localParticipant.setMicrophoneEnabled(false)
      } else if (!mutedBeforeDeafenRef.current) {
        await localParticipant.setMicrophoneEnabled(true)
      }
    },
    [room],
  )

  const setMicrophoneMuted = useCallback(
    async (muted: boolean) => {
      if (!room) {
        return
      }
      // Speaking while hearing nobody makes no sense.
      if (!muted) {
        setIsDeafened(false)
      }
      await room.localParticipant.setMicrophoneEnabled(!muted)
    },
    [room],
  )

  const setParticipantVolume = useCallback((identity: string, volume: number) => {
    setVolumes((current) => new Map(current).set(identity, volume))
  }, [])

  return { isDeafened, volumes, setDeafened, setMicrophoneMuted, setParticipantVolume }
}

/** Adds what only this client knows: its own deafen state and the chosen volumes. */
export function useParticipantsWithAudio(
  participants: VoiceParticipant[],
  isDeafened: boolean,
  volumes: ReadonlyMap<string, number>,
): VoiceParticipant[] {
  return useMemo(
    () =>
      participants.map((participant) =>
        participant.isLocal
          ? { ...participant, isDeafened }
          : { ...participant, volume: volumes.get(participant.identity) ?? 1 },
      ),
    [participants, isDeafened, volumes],
  )
}
