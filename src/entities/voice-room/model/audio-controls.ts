import { RoomEvent, Track, type RemoteParticipant, type Room } from 'livekit-client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { VoiceParticipant } from './context'

/** Participant attribute other clients read to show that someone hears nobody. */
export const DEAFENED_ATTRIBUTE = 'deafened'

/**
 * Mute and deafen are choices about the person, not about the room: they are
 * remembered on this device and applied to the next room as it connects.
 */
const MICROPHONE_MUTED_KEY = 'orbit.voice.microphone-muted'
const DEAFENED_KEY = 'orbit.voice.deafened'

const readFlag = (key: string): boolean => {
  try {
    return localStorage.getItem(key) === 'true'
  } catch {
    // Storage can be blocked; the choice then lasts for this page only.
    return false
  }
}

const writeFlag = (key: string, value: boolean): void => {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Same: the control still works, it just is not remembered.
  }
}

/**
 * Mute, deafen and per-participant volume. The state lives here even before a
 * room exists, so the user panel can be used first and connect later.
 * Deafen is local playback at zero plus the `deafened` attribute, so others can see it.
 */
export function useAudioControls(room: Room | null) {
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(() => readFlag(MICROPHONE_MUTED_KEY))
  const [isDeafened, setIsDeafened] = useState(() => readFlag(DEAFENED_KEY))
  const [volumes, setVolumes] = useState<ReadonlyMap<string, number>>(new Map())
  const [stateRoom, setStateRoom] = useState(room)
  const mutedBeforeDeafenRef = useRef(false)

  // A new room (or leaving) starts with everyone audible.
  if (room !== stateRoom) {
    setStateRoom(room)
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
      setIsDeafened(deafened)
      writeFlag(DEAFENED_KEY, deafened)
      if (deafened) {
        // Remember what the microphone was doing, so undeafening can restore it.
        mutedBeforeDeafenRef.current = isMicrophoneMuted
        setIsMicrophoneMuted(true)
        writeFlag(MICROPHONE_MUTED_KEY, true)
        await room?.localParticipant.setMicrophoneEnabled(false)
        return
      }
      const muted = mutedBeforeDeafenRef.current
      setIsMicrophoneMuted(muted)
      writeFlag(MICROPHONE_MUTED_KEY, muted)
      if (room) {
        await room.localParticipant.setMicrophoneEnabled(!muted)
      }
    },
    [room, isMicrophoneMuted],
  )

  const setMicrophoneMuted = useCallback(
    async (muted: boolean) => {
      setIsMicrophoneMuted(muted)
      writeFlag(MICROPHONE_MUTED_KEY, muted)
      // Speaking while hearing nobody makes no sense.
      if (!muted) {
        setIsDeafened(false)
        writeFlag(DEAFENED_KEY, false)
      }
      if (room) {
        await room.localParticipant.setMicrophoneEnabled(!muted)
      }
    },
    [room],
  )

  const setParticipantVolume = useCallback((identity: string, volume: number) => {
    setVolumes((current) => new Map(current).set(identity, volume))
  }, [])

  return {
    isMicrophoneMuted,
    isDeafened,
    volumes,
    setDeafened,
    setMicrophoneMuted,
    setParticipantVolume,
  }
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
