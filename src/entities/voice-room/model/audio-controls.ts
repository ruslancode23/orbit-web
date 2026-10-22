import {
  createLocalAudioTrack,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type Room,
} from 'livekit-client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  readInputMode,
  readPushToTalkKey,
  saveInputMode,
  savePushToTalkKey,
  type InputMode,
} from './voice-preferences'

import type { VoiceParticipant } from './context'

/** Participant attribute other clients read to show that someone hears nobody. */
export const DEAFENED_ATTRIBUTE = 'deafened'

/**
 * Set while the participant talks by holding a key and has not muted. Their
 * track is muted between phrases, and others should read that as quiet, not muted.
 */
export const PUSH_TO_TALK_ATTRIBUTE = 'push-to-talk'

/** How long the microphone stays open after the key is let go, so the end of a word is not cut. */
export const PUSH_TO_TALK_RELEASE_MS = 200

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
 * Mute, deafen, push-to-talk and per-participant volume. The state lives here
 * even before a room exists, so the user panel can be used first and connect later.
 * Deafen is local playback at zero plus the `deafened` attribute, so others can see it.
 *
 * With push-to-talk the microphone is published muted as soon as it may be
 * used, and holding the key only unmutes it: opening a device on the first
 * press would cut the start of every phrase, and publishing it open for a
 * moment would send what the person did not mean to say.
 */
export function useAudioControls(room: Room | null) {
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(() => readFlag(MICROPHONE_MUTED_KEY))
  const [isDeafened, setIsDeafened] = useState(() => readFlag(DEAFENED_KEY))
  const [inputMode, setInputModeState] = useState(readInputMode)
  const [pushToTalkKey, setPushToTalkKeyState] = useState(readPushToTalkKey)
  const [isPushToTalkHeld, setIsPushToTalkHeld] = useState(false)
  const [volumes, setVolumes] = useState<ReadonlyMap<string, number>>(new Map())
  const [stateRoom, setStateRoom] = useState(room)
  const mutedBeforeDeafenRef = useRef(false)
  const heldRef = useRef(false)
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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

  const talksByKey = inputMode === 'push-to-talk' && !isMicrophoneMuted

  useEffect(() => {
    if (!room) {
      return
    }
    const wanted = {
      [DEAFENED_ATTRIBUTE]: String(isDeafened),
      [PUSH_TO_TALK_ATTRIBUTE]: String(talksByKey),
    }
    const publish = () => {
      const { attributes } = room.localParticipant
      const same = Object.entries(wanted).every(
        ([name, value]) => (attributes[name] ?? 'false') === value,
      )
      if (same) {
        return
      }
      // Without the permission in the token others just do not see it; local deafen still works.
      room.localParticipant.setAttributes(wanted).catch(() => undefined)
    }
    publish()
    // A full reconnect is a new session on the server, without the attributes.
    room.on(RoomEvent.Reconnected, publish)
    return () => {
      room.off(RoomEvent.Reconnected, publish)
    }
  }, [room, isDeafened, talksByKey])

  useEffect(
    () => () => {
      clearTimeout(releaseTimerRef.current)
    },
    [],
  )

  /** Puts the microphone of `target` where the person wants it: open, muted or ready for the key. */
  const applyMicrophone = useCallback(async (target: Room, muted: boolean, mode: InputMode) => {
    if (!muted && mode === 'push-to-talk' && !heldRef.current) {
      await publishMuted(target)
      return
    }
    await target.localParticipant.setMicrophoneEnabled(!muted)
  }, [])

  /** Called once the room is connected, from the join click. */
  const publishMicrophone = useCallback(
    (target: Room) => applyMicrophone(target, isMicrophoneMuted, inputMode),
    [applyMicrophone, isMicrophoneMuted, inputMode],
  )

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
        await applyMicrophone(room, muted, inputMode)
      }
    },
    [room, isMicrophoneMuted, inputMode, applyMicrophone],
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
        await applyMicrophone(room, muted, inputMode)
      }
    },
    [room, inputMode, applyMicrophone],
  )

  const setInputMode = useCallback(
    async (mode: InputMode) => {
      setInputModeState(mode)
      saveInputMode(mode)
      clearTimeout(releaseTimerRef.current)
      heldRef.current = false
      setIsPushToTalkHeld(false)
      if (room) {
        await applyMicrophone(room, isMicrophoneMuted, mode)
      }
    },
    [room, isMicrophoneMuted, applyMicrophone],
  )

  const setPushToTalkKey = useCallback((code: string) => {
    setPushToTalkKeyState(code)
    savePushToTalkKey(code)
  }, [])

  const pressPushToTalk = useCallback(() => {
    clearTimeout(releaseTimerRef.current)
    if (heldRef.current) {
      return
    }
    heldRef.current = true
    setIsPushToTalkHeld(true)
    if (room && inputMode === 'push-to-talk' && !isMicrophoneMuted) {
      room.localParticipant.setMicrophoneEnabled(true).catch(() => undefined)
    }
  }, [room, inputMode, isMicrophoneMuted])

  const releasePushToTalk = useCallback(
    (immediately = false) => {
      if (!heldRef.current) {
        return
      }
      clearTimeout(releaseTimerRef.current)
      const release = () => {
        heldRef.current = false
        setIsPushToTalkHeld(false)
        if (room && inputMode === 'push-to-talk') {
          room.localParticipant.setMicrophoneEnabled(false).catch(() => undefined)
        }
      }
      if (immediately) {
        release()
        return
      }
      releaseTimerRef.current = setTimeout(release, PUSH_TO_TALK_RELEASE_MS)
    },
    [room, inputMode],
  )

  const setParticipantVolume = useCallback((identity: string, volume: number) => {
    setVolumes((current) => new Map(current).set(identity, volume))
  }, [])

  return {
    isMicrophoneMuted,
    isDeafened,
    inputMode,
    pushToTalkKey,
    isPushToTalkHeld,
    volumes,
    publishMicrophone,
    setDeafened,
    setMicrophoneMuted,
    setInputMode,
    setPushToTalkKey,
    pressPushToTalk,
    releasePushToTalk,
    setParticipantVolume,
  }
}

/**
 * The microphone published but silent: unmuting a published track is instant,
 * while opening the device takes a moment. A track already published is only muted.
 */
const publishMuted = async (room: Room): Promise<void> => {
  const { localParticipant } = room
  if (localParticipant.getTrackPublication(Track.Source.Microphone)) {
    await localParticipant.setMicrophoneEnabled(false)
    return
  }
  const track = await createLocalAudioTrack(room.options.audioCaptureDefaults)
  await track.mute()
  await localParticipant.publishTrack(track, { source: Track.Source.Microphone })
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
