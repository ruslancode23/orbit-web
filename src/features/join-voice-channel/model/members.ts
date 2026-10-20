import type { VoiceParticipant } from '@/entities/voice-room'
import type { VoicePresence } from '@/shared/api'

/** One row under a voice channel, from server presence or from the live room. */
export interface VoiceChannelMember {
  id: string
  name: string
  muted: boolean
  deafened: boolean
  screenSharing: boolean
  speaking: boolean
}

export const membersFromPresence = (presence: VoicePresence | undefined): VoiceChannelMember[] =>
  (presence?.participants ?? []).map((participant) => ({
    id: participant.userId,
    name: participant.name,
    muted: participant.muted,
    deafened: participant.deafened,
    screenSharing: participant.screenSharing,
    speaking: false,
  }))

export const membersFromRoom = (
  participants: VoiceParticipant[],
  screenSharers: string[],
): VoiceChannelMember[] =>
  participants.map((participant) => ({
    id: participant.identity,
    name: participant.name,
    muted: participant.isMicrophoneMuted,
    deafened: participant.isDeafened,
    screenSharing: screenSharers.includes(participant.identity),
    speaking: participant.isSpeaking,
  }))
