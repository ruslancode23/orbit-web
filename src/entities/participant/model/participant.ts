/** What the room UI shows about one participant. `VoiceParticipant` from the voice room fits it. */
export interface Participant {
  identity: string
  name: string
  isLocal: boolean
  isSpeaking: boolean
  isMicrophoneMuted: boolean
  isDeafened: boolean
}

const graphemes = new Intl.Segmenter('ru', { granularity: 'grapheme' })

/** Up to two letters for the avatar: «Анна Ли» → «АЛ», «bob» → «B». */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(graphemes.segment(word))[0]?.segment ?? '')
    .join('')
  return letters.toLocaleUpperCase('ru') || '?'
}

/** The participant's voice state in words, for screen readers and tooltips. */
export function describeVoiceState({
  isSpeaking,
  isMicrophoneMuted,
  isDeafened,
}: Participant): string[] {
  const state: string[] = []
  if (isSpeaking) state.push('говорит')
  if (isDeafened) state.push('звук выключен')
  else if (isMicrophoneMuted) state.push('микрофон выключен')
  return state
}
