import { createContext, use } from 'react'

import type { RemoteVideoTrack, Room } from 'livekit-client'

export type VoiceRoomStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'

export interface VoiceParticipant {
  identity: string
  name: string
  isLocal: boolean
  /** From LiveKit's active speaker updates. */
  isSpeaking: boolean
  isMicrophoneMuted: boolean
  /** The participant hears nobody; published as the `deafened` attribute. */
  isDeafened: boolean
  /** How loud this participant plays here, 0–1. Always 1 for the local participant. */
  volume: number
}

export interface RemoteScreenShare {
  participantIdentity: string
  participantName: string
  track: RemoteVideoTrack
}

export interface JoinParams {
  /** LiveKit URL returned by orbit-server together with the token. */
  url: string
  token: string
}

export interface VoiceRoomValue {
  status: VoiceRoomStatus
  participants: VoiceParticipant[]
  screenShares: RemoteScreenShare[]
  isSharingScreen: boolean
  error: string | null
  /** The connected room, for features that act on it (screen share, devices). */
  room: Room | null
  join: (params: JoinParams) => Promise<void>
  leave: () => Promise<void>
  /** Unmuting while deafened also brings the sound back. */
  setMicrophoneMuted: (muted: boolean) => Promise<void>
  /** Silences everyone here and mutes the microphone; undeafening restores the microphone as it was. */
  setDeafened: (deafened: boolean) => Promise<void>
  /** Local playback volume of a remote participant, 0–1. */
  setParticipantVolume: (identity: string, volume: number) => void
}

export const VoiceRoomContext = createContext<VoiceRoomValue | null>(null)

export function useVoiceRoom(): VoiceRoomValue {
  const value = use(VoiceRoomContext)
  if (!value) throw new Error('useVoiceRoom must be used inside <VoiceRoomProvider>')
  return value
}
