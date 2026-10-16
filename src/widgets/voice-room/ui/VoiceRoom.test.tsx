import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { useVoiceRoom, VoiceRoomProvider } from '@/entities/voice-room'
import { fakeLiveKit, fakeRemoteParticipant, renderWithProviders } from '@/shared/lib/test'

import { VoiceRoom } from './VoiceRoom'

import type * as LiveKit from 'livekit-client'

vi.mock('livekit-client', async (importOriginal) => ({
  ...(await importOriginal<typeof LiveKit>()),
  Room: (await import('@/shared/lib/test')).FakeRoom,
}))

function Connect() {
  const { join } = useVoiceRoom()
  return (
    <button type="button" onClick={() => void join({ url: 'ws://lk.test', token: 'jwt' })}>
      connect
    </button>
  )
}

async function renderConnected() {
  renderWithProviders(
    <VoiceRoomProvider>
      <Connect />
      <VoiceRoom />
    </VoiceRoomProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'connect' }))
  await screen.findByRole('list', { name: 'Участники' })
  return fakeLiveKit.lastRoom()
}

function addRemote(room: ReturnType<typeof fakeLiveKit.lastRoom>, name: string) {
  const participant = fakeRemoteParticipant(`guest-${name.toLowerCase()}`, name)
  act(() => {
    room.remoteParticipants.set(participant.identity, participant)
    room.emit('participantConnected', participant)
  })
  return participant
}

const card = (name: string) =>
  within(screen.getByRole('list', { name: 'Участники' }))
    .getByText(name)
    .closest('[data-speaking]')

beforeEach(() => {
  fakeLiveKit.reset()
})

describe('VoiceRoom', () => {
  it('is hidden until the room is joined', () => {
    renderWithProviders(
      <VoiceRoomProvider>
        <VoiceRoom />
      </VoiceRoomProvider>,
    )

    expect(screen.queryByRole('region', { name: 'Голосовая комната' })).not.toBeInTheDocument()
  })

  it('lists the participants, the local one first', async () => {
    const room = await renderConnected()

    addRemote(room, 'Bob')

    const items = within(screen.getByRole('list', { name: 'Участники' })).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['AAnna (вы)', 'BBob'])
  })

  it('lights the speaking indicator on the active speakers event and turns it off', async () => {
    const room = await renderConnected()
    const bob = addRemote(room, 'Bob')

    act(() => {
      bob.isSpeaking = true
      room.emit('activeSpeakersChanged', [bob])
    })

    expect(card('Bob')).toHaveAttribute('data-speaking', 'true')
    expect(card('Bob')).toHaveTextContent('Bob, говорит')
    expect(card('Anna')).toHaveAttribute('data-speaking', 'false')

    act(() => {
      bob.isSpeaking = false
      room.emit('activeSpeakersChanged', [])
    })

    expect(card('Bob')).toHaveAttribute('data-speaking', 'false')
  })

  it('shows a remote participant muting and deafening', async () => {
    const room = await renderConnected()
    const bob = addRemote(room, 'Bob')

    act(() => {
      bob.isMicrophoneEnabled = false
      room.emit('trackMuted', { source: 'microphone' }, bob)
    })
    expect(card('Bob')).toHaveTextContent('Bob, микрофон выключен')

    act(() => {
      bob.attributes = { deafened: 'true' }
      room.emit('participantAttributesChanged', { deafened: 'true' }, bob)
    })
    expect(card('Bob')).toHaveTextContent('Bob, звук выключен')
  })

  it('mutes and unmutes the microphone from the keyboard', async () => {
    const room = await renderConnected()
    const mute = screen.getByRole('button', { name: 'Выключить микрофон' })
    expect(mute).toHaveAttribute('aria-pressed', 'false')

    mute.focus()
    await userEvent.keyboard('{Enter}')

    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenLastCalledWith(false)
    expect(mute).toHaveAttribute('aria-pressed', 'true')
    expect(card('Anna')).toHaveTextContent('микрофон выключен')

    await userEvent.keyboard(' ')

    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenLastCalledWith(true)
    expect(mute).toHaveAttribute('aria-pressed', 'false')
  })

  it('deafens: silences everyone, mutes the microphone and tells the others', async () => {
    const room = await renderConnected()
    const bob = addRemote(room, 'Bob')

    await userEvent.click(screen.getByRole('button', { name: 'Выключить звук' }))

    expect(screen.getByRole('button', { name: 'Выключить звук' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(bob.setVolume).toHaveBeenLastCalledWith(0, 'screen_share_audio')
    expect(bob.setVolume).toHaveBeenCalledWith(0, 'microphone')
    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenLastCalledWith(false)
    expect(room.localParticipant.setAttributes).toHaveBeenLastCalledWith({ deafened: 'true' })
    expect(card('Anna')).toHaveTextContent('звук выключен')

    // Someone joining while deafened is silent too.
    const carol = addRemote(room, 'Carol')
    expect(carol.setVolume).toHaveBeenCalledWith(0, 'microphone')

    await userEvent.click(screen.getByRole('button', { name: 'Выключить звук' }))

    expect(bob.setVolume).toHaveBeenCalledWith(1, 'microphone')
    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenLastCalledWith(true)
    expect(room.localParticipant.setAttributes).toHaveBeenLastCalledWith({ deafened: 'false' })
    expect(card('Anna')).not.toHaveTextContent('звук выключен')
  })

  it('keeps the microphone muted after undeafening if it was muted before', async () => {
    const room = await renderConnected()
    await userEvent.click(screen.getByRole('button', { name: 'Выключить микрофон' }))

    await userEvent.click(screen.getByRole('button', { name: 'Выключить звук' }))
    await userEvent.click(screen.getByRole('button', { name: 'Выключить звук' }))

    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenLastCalledWith(false)
    expect(screen.getByRole('button', { name: 'Выключить микрофон' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('brings the sound back when unmuting while deafened', async () => {
    const room = await renderConnected()
    const bob = addRemote(room, 'Bob')
    await userEvent.click(screen.getByRole('button', { name: 'Выключить звук' }))

    await userEvent.click(screen.getByRole('button', { name: 'Выключить микрофон' }))

    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenLastCalledWith(true)
    expect(screen.getByRole('button', { name: 'Выключить звук' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(bob.setVolume).toHaveBeenLastCalledWith(1, 'screen_share_audio')
  })

  it('sets one participant volume with the arrow keys', async () => {
    const room = await renderConnected()
    const bob = addRemote(room, 'Bob')
    const slider = screen.getByRole('slider', { name: 'Громкость: Bob' })
    expect(slider).toHaveAttribute('aria-valuetext', '100 %')
    expect(screen.queryByRole('slider', { name: 'Громкость: Anna' })).not.toBeInTheDocument()

    slider.focus()
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')

    expect(slider).toHaveAttribute('aria-valuenow', '90')
    expect(bob.setVolume).toHaveBeenLastCalledWith(1, 'screen_share_audio')
    expect(bob.setVolume).toHaveBeenCalledWith(0.9, 'microphone')
  })

  it('explains when the microphone cannot be turned back on', async () => {
    const room = await renderConnected()
    await userEvent.click(screen.getByRole('button', { name: 'Выключить микрофон' }))
    fakeLiveKit.micError = new DOMException('Device gone', 'NotFoundError')

    await userEvent.click(screen.getByRole('button', { name: 'Выключить микрофон' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось включить микрофон')
    expect(room.localParticipant.isMicrophoneEnabled).toBe(false)
  })
})
