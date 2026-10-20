import { describeVoiceState, type Participant } from './participant'

const anna: Participant = {
  identity: 'guest-anna',
  name: 'Anna',
  isLocal: false,
  isSpeaking: false,
  isMicrophoneMuted: false,
  isDeafened: false,
}

describe('describeVoiceState', () => {
  it('is empty for someone listening quietly', () => {
    expect(describeVoiceState(anna)).toEqual([])
  })

  it('names speaking and a muted microphone', () => {
    expect(describeVoiceState({ ...anna, isSpeaking: true })).toEqual(['говорит'])
    expect(describeVoiceState({ ...anna, isMicrophoneMuted: true })).toEqual(['микрофон выключен'])
  })

  it('says deafened instead of muted, since deafen mutes too', () => {
    expect(describeVoiceState({ ...anna, isMicrophoneMuted: true, isDeafened: true })).toEqual([
      'звук выключен',
    ])
  })
})
