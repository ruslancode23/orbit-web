import { initials } from '@/shared/lib/initials'

export { initials }

/** What the room UI shows about one participant. `VoiceParticipant` from the voice room fits it. */
export interface Participant {
  identity: string
  name: string
  isLocal: boolean
  isSpeaking: boolean
  isMicrophoneMuted: boolean
  isDeafened: boolean
}

/** The participant's voice state in words, for screen readers and tooltips. */
export function describeVoiceState({
  isSpeaking,
  isMicrophoneMuted,
  isDeafened,
}: Participant): string[] {
  const state: string[] = []
  if (isSpeaking) {
    state.push('говорит')
  }
  if (isDeafened) {
    state.push('звук выключен')
  } else if (isMicrophoneMuted) {
    state.push('микрофон выключен')
  }
  return state
}
