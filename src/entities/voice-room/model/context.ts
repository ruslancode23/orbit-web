import { createContext, use } from 'react'

import type { AudioProcessing, InputMode, NoiseSuppressionMode } from './voice-preferences'
import type { RemoteVideoTrack, Room } from 'livekit-client'

/**
 * `reconnecting` — the network dropped and LiveKit is retrying on its own;
 * `disconnected` — the room was lost and did not come back (see `connectionLoss`);
 * `error` — joining failed.
 */
export type VoiceRoomStatus =
  'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'

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

/** Why a joined room was lost without the user leaving it. */
export interface ConnectionLoss {
  message: string
  /** False when joining again would not help, e.g. the participant was removed. */
  canRetry: boolean
  /** The name the user joined with, to ask for a fresh token. */
  displayName: string
}

/** The voice channel this client is connected (or trying to connect) to. */
export interface ActiveVoiceChannel {
  id: string
  workspaceId: string
  name: string
}

export interface JoinParams {
  /** LiveKit URL returned by orbit-server together with the token. */
  url: string
  token: string
  /** The channel the token was issued for, so the panel can name it. */
  channel?: ActiveVoiceChannel
}

export interface VoiceRoomValue {
  status: VoiceRoomStatus
  participants: VoiceParticipant[]
  screenShares: RemoteScreenShare[]
  isSharingScreen: boolean
  error: string | null
  /** Set while `status` is `disconnected`. */
  connectionLoss: ConnectionLoss | null
  /** The connected room, for features that act on it (screen share, devices). */
  room: Room | null
  /** Null until the first channel is joined; kept while the room reconnects. */
  activeChannel: ActiveVoiceChannel | null
  /** True before joining too: the choice is remembered on this device. */
  isMicrophoneMuted: boolean
  /** True before joining too; deafen also mutes the microphone. */
  isDeafened: boolean
  join: (params: JoinParams) => Promise<void>
  leave: () => Promise<void>
  /** Unmuting while deafened also brings the sound back. */
  setMicrophoneMuted: (muted: boolean) => Promise<void>
  /** Silences everyone here and mutes the microphone; undeafening restores the microphone as it was. */
  setDeafened: (deafened: boolean) => Promise<void>
  /** Local playback volume of a remote participant, 0–1. */
  setParticipantVolume: (identity: string, volume: number) => void
  /** The browser's processing of the microphone; remembered on this device. */
  audioProcessing: AudioProcessing
  /** Applies to the running microphone without leaving the call, and to the next room. */
  setAudioProcessing: (processing: AudioProcessing) => Promise<void>
  /** Off, the browser's own, or RNNoise (`enhanced`); remembered on this device. */
  noiseSuppressionMode: NoiseSuppressionMode
  setNoiseSuppressionMode: (mode: NoiseSuppressionMode) => Promise<void>
  /** RNNoise could not run in this browser, and the standard suppression took its place. */
  enhancedNoiseSuppressionUnavailable: boolean
  /** Voice activity, or the microphone open only while a key is held. Remembered on this device. */
  inputMode: InputMode
  setInputMode: (mode: InputMode) => Promise<void>
  /** `KeyboardEvent.code` of the push-to-talk key; see `describeKey`. */
  pushToTalkKey: string
  setPushToTalkKey: (code: string) => void
  /** The key or the panel button is held (or was let go less than 200 ms ago). */
  isPushToTalkHeld: boolean
  /** Opens the microphone in push-to-talk; does nothing while muted or deafened. */
  pressPushToTalk: () => void
  /** Closes it after a short delay, or at once when focus left the page. */
  releasePushToTalk: (immediately?: boolean) => void
}

export const VoiceRoomContext = createContext<VoiceRoomValue | null>(null)

export function useVoiceRoom(): VoiceRoomValue {
  const value = use(VoiceRoomContext)
  if (!value) {
    throw new Error('useVoiceRoom must be used inside <VoiceRoomProvider>')
  }
  return value
}
