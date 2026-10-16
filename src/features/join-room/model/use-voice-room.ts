import { ConnectionState, Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client'
import { useCallback, useEffect, useRef, useState } from 'react'

export type VoiceRoomStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'

export interface VoiceParticipant {
  identity: string
  name: string
  isLocal: boolean
}

interface JoinParams {
  /** LiveKit URL returned by orbit-server together with the token. */
  url: string
  token: string
}

/**
 * One LiveKit voice room: connects, publishes the microphone, plays remote audio
 * and releases the microphone on leave or unmount.
 */
export function useVoiceRoom() {
  const roomRef = useRef<Room | null>(null)
  const audioRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<VoiceRoomStatus>('idle')
  const [participants, setParticipants] = useState<VoiceParticipant[]>([])
  const [error, setError] = useState<string | null>(null)

  const join = useCallback(async ({ url, token }: JoinParams) => {
    await roomRef.current?.disconnect()

    const room = new Room({ adaptiveStream: true, dynacast: true })
    roomRef.current = room
    const sync = () => {
      setParticipants(listParticipants(room))
    }

    room
      .on(RoomEvent.ConnectionStateChanged, (state) => {
        if (
          state === ConnectionState.Reconnecting ||
          state === ConnectionState.SignalReconnecting
        ) {
          setStatus('reconnecting')
        } else if (state === ConnectionState.Connected) {
          setStatus('connected')
        }
      })
      .on(RoomEvent.ParticipantConnected, sync)
      .on(RoomEvent.ParticipantDisconnected, sync)
      .on(RoomEvent.TrackSubscribed, (track) => {
        attachAudio(track, audioRef.current)
      })
      .on(RoomEvent.TrackUnsubscribed, detach)
      .on(RoomEvent.Disconnected, () => {
        if (roomRef.current !== room) return
        roomRef.current = null
        setParticipants([])
        setStatus('idle')
      })

    setError(null)
    setStatus('connecting')
    try {
      await room.connect(url, token)
      // Called from the join click, so the browser allows audio playback.
      await room.startAudio()
      await room.localParticipant.setMicrophoneEnabled(true)
      sync()
      setStatus('connected')
    } catch (cause) {
      roomRef.current = null
      await room.disconnect()
      setParticipants([])
      setError(describeJoinError(cause))
      setStatus('error')
    }
  }, [])

  const leave = useCallback(async () => {
    const room = roomRef.current
    roomRef.current = null
    // disconnect() stops local tracks, so the microphone indicator goes off.
    await room?.disconnect()
    setParticipants([])
    setStatus('idle')
  }, [])

  // A hidden element that holds the remote <audio> elements; set through `attachAudioContainer`.
  const [audioContainer, attachAudioContainer] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    audioRef.current = audioContainer
  }, [audioContainer])

  useEffect(
    () => () => {
      void roomRef.current?.disconnect()
      roomRef.current = null
    },
    [],
  )

  return { status, participants, error, join, leave, attachAudioContainer }
}

function listParticipants(room: Room): VoiceParticipant[] {
  const local = room.localParticipant
  return [
    { identity: local.identity, name: displayName(local), isLocal: true },
    ...[...room.remoteParticipants.values()].map((p) => ({
      identity: p.identity,
      name: displayName(p),
      isLocal: false,
    })),
  ]
}

// LiveKit reports a participant without a name as an empty string.
function displayName({ name, identity }: { name?: string; identity: string }): string {
  return name !== undefined && name !== '' ? name : identity
}

function attachAudio(track: RemoteTrack, container: HTMLElement | null) {
  if (track.kind !== Track.Kind.Audio || !container) return
  container.append(track.attach())
}

function detach(track: RemoteTrack) {
  for (const element of track.detach()) element.remove()
}

function describeJoinError(cause: unknown): string {
  if (cause instanceof DOMException && cause.name === 'NotAllowedError') {
    return 'Нет доступа к микрофону. Разрешите его в настройках браузера и попробуйте снова.'
  }
  if (cause instanceof DOMException && cause.name === 'NotFoundError') {
    return 'Микрофон не найден.'
  }
  return 'Не удалось подключиться к комнате. Попробуйте ещё раз.'
}
