import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type LocalTrackPublication,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteVideoTrack,
} from 'livekit-client'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { DEAFENED_ATTRIBUTE, useAudioControls, useParticipantsWithAudio } from './audio-controls'
import {
  VoiceRoomContext,
  type JoinParams,
  type RemoteScreenShare,
  type VoiceParticipant,
  type VoiceRoomStatus,
  type VoiceRoomValue,
} from './context'

/**
 * Owns one LiveKit voice room for the subtree: connects, publishes the microphone,
 * plays remote audio, tracks remote screen shares, and releases everything on leave or unmount.
 */
export function VoiceRoomProvider({ children }: { children: ReactNode }) {
  const roomRef = useRef<Room | null>(null)
  const audioRef = useRef<HTMLDivElement | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [status, setStatus] = useState<VoiceRoomStatus>('idle')
  const [participants, setParticipants] = useState<VoiceParticipant[]>([])
  const [screenShares, setScreenShares] = useState<RemoteScreenShare[]>([])
  const [isSharingScreen, setIsSharingScreen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setRoom(null)
    setParticipants([])
    setScreenShares([])
    setIsSharingScreen(false)
  }, [])

  const join = useCallback(
    async ({ url, token }: JoinParams) => {
      await roomRef.current?.disconnect()

      const next = new Room({ adaptiveStream: true, dynacast: true })
      roomRef.current = next
      const sync = () => {
        setParticipants(listParticipants(next))
      }
      const syncLocalScreen = (publication: LocalTrackPublication) => {
        if (publication.source === Track.Source.ScreenShare) {
          setIsSharingScreen(next.localParticipant.isScreenShareEnabled)
        }
      }

      next
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
        .on(RoomEvent.ParticipantDisconnected, (participant) => {
          sync()
          setScreenShares((shares) =>
            shares.filter((s) => s.participantIdentity !== participant.identity),
          )
        })
        .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === Track.Kind.Audio) {
            audioRef.current?.append(track.attach())
          } else if (isScreenShare(track, publication)) {
            setScreenShares((shares) => [
              ...shares.filter((s) => s.track !== track),
              {
                participantIdentity: participant.identity,
                participantName: displayName(participant),
                track,
              },
            ])
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          for (const element of track.detach()) element.remove()
          setScreenShares((shares) => shares.filter((s) => s.track !== track))
        })
        // Speaking comes as events from the server's audio level observer, not by polling levels.
        .on(RoomEvent.ActiveSpeakersChanged, sync)
        .on(RoomEvent.TrackPublished, sync)
        .on(RoomEvent.TrackUnpublished, sync)
        .on(RoomEvent.TrackMuted, sync)
        .on(RoomEvent.TrackUnmuted, sync)
        .on(RoomEvent.ParticipantAttributesChanged, sync)
        // Also fires when the browser's own "Stop sharing" ends the track: LiveKit unpublishes it.
        .on(RoomEvent.LocalTrackPublished, syncLocalScreen)
        .on(RoomEvent.LocalTrackUnpublished, syncLocalScreen)
        .on(RoomEvent.Disconnected, () => {
          if (roomRef.current !== next) return
          roomRef.current = null
          reset()
          setStatus('idle')
        })

      setError(null)
      setStatus('connecting')
      try {
        await next.connect(url, token)
        // Called from the join click, so the browser allows audio playback.
        await next.startAudio()
        await next.localParticipant.setMicrophoneEnabled(true)
        sync()
        setRoom(next)
        setStatus('connected')
      } catch (cause) {
        roomRef.current = null
        await next.disconnect()
        reset()
        setError(describeJoinError(cause))
        setStatus('error')
      }
    },
    [reset],
  )

  const leave = useCallback(async () => {
    const current = roomRef.current
    roomRef.current = null
    // disconnect() stops local tracks: the microphone and any screen share are released.
    await current?.disconnect()
    reset()
    setStatus('idle')
  }, [reset])

  const { isDeafened, volumes, setDeafened, setMicrophoneMuted, setParticipantVolume } =
    useAudioControls(room)
  const participantsWithAudio = useParticipantsWithAudio(participants, isDeafened, volumes)

  useEffect(
    () => () => {
      void roomRef.current?.disconnect()
      roomRef.current = null
    },
    [],
  )

  const value = useMemo<VoiceRoomValue>(
    () => ({
      status,
      participants: participantsWithAudio,
      screenShares,
      isSharingScreen,
      error,
      room,
      join,
      leave,
      setMicrophoneMuted,
      setDeafened,
      setParticipantVolume,
    }),
    [
      status,
      participantsWithAudio,
      screenShares,
      isSharingScreen,
      error,
      room,
      join,
      leave,
      setMicrophoneMuted,
      setDeafened,
      setParticipantVolume,
    ],
  )

  return (
    <VoiceRoomContext value={value}>
      {children}
      <div ref={audioRef} hidden data-testid="remote-audio" />
    </VoiceRoomContext>
  )
}

function isScreenShare(
  track: RemoteTrack,
  publication: RemoteTrackPublication,
): track is RemoteVideoTrack {
  return track.kind === Track.Kind.Video && publication.source === Track.Source.ScreenShare
}

function listParticipants(room: Room): VoiceParticipant[] {
  return [
    toVoiceParticipant(room.localParticipant, true),
    ...[...room.remoteParticipants.values()].map((p: RemoteParticipant) =>
      toVoiceParticipant(p, false),
    ),
  ]
}

function toVoiceParticipant(participant: Participant, isLocal: boolean): VoiceParticipant {
  return {
    identity: participant.identity,
    name: displayName(participant),
    isLocal,
    isSpeaking: participant.isSpeaking,
    isMicrophoneMuted: !participant.isMicrophoneEnabled,
    isDeafened: participant.attributes[DEAFENED_ATTRIBUTE] === 'true',
    volume: 1,
  }
}

// LiveKit reports a participant without a name as an empty string.
function displayName({ name, identity }: { name?: string; identity: string }): string {
  return name !== undefined && name !== '' ? name : identity
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
