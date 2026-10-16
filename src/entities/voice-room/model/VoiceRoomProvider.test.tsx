import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DisconnectReason } from 'livekit-client'

import { fakeLiveKit, fakeRemoteParticipant } from '@/shared/lib/test'

import { useVoiceRoom } from './context'
import { VoiceRoomProvider } from './VoiceRoomProvider'

import type * as LiveKit from 'livekit-client'

vi.mock('livekit-client', async (importOriginal) => ({
  ...(await importOriginal<typeof LiveKit>()),
  Room: (await import('@/shared/lib/test')).FakeRoom,
}))

function Probe() {
  const { status, participants, connectionLoss, join } = useVoiceRoom()
  return (
    <>
      <button type="button" onClick={() => void join({ url: 'ws://lk.test', token: 'jwt' })}>
        connect
      </button>
      <output aria-label="status">{status}</output>
      <output aria-label="participants">{participants.map((p) => p.name).join(', ')}</output>
      <output aria-label="loss">
        {connectionLoss &&
          `${connectionLoss.message} retry=${String(connectionLoss.canRetry)} as=${connectionLoss.displayName}`}
      </output>
    </>
  )
}

async function renderConnected() {
  render(
    <VoiceRoomProvider>
      <Probe />
    </VoiceRoomProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'connect' }))
  expect(screen.getByRole('status', { name: 'status' })).toHaveTextContent('connected')
  return fakeLiveKit.lastRoom()
}

const status = () => screen.getByRole('status', { name: 'status' })

beforeEach(() => {
  fakeLiveKit.reset()
})

describe('VoiceRoomProvider reconnection', () => {
  it.each(['reconnecting', 'signalReconnecting'])(
    'is reconnecting on %s and connected again on reconnected, in the same room',
    async (event) => {
      const room = await renderConnected()

      act(() => {
        room.emit(event)
      })
      expect(status()).toHaveTextContent('reconnecting')

      act(() => {
        room.emit('reconnected')
      })
      expect(status()).toHaveTextContent('connected')
      expect(fakeLiveKit.rooms).toHaveLength(1)
      expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledOnce()
    },
  )

  it('lists participants again after a reconnect', async () => {
    const room = await renderConnected()
    act(() => {
      room.emit('reconnecting')
    })

    room.remoteParticipants.set('guest-bob', fakeRemoteParticipant('guest-bob', 'Bob'))
    act(() => {
      room.emit('reconnected')
    })

    expect(screen.getByRole('status', { name: 'participants' })).toHaveTextContent('Anna, Bob')
  })

  it('reports a lost room with the name to join again as', async () => {
    const room = await renderConnected()
    act(() => {
      room.emit('reconnecting')
      room.emit('disconnected', DisconnectReason.SIGNAL_CLOSE)
    })

    expect(status()).toHaveTextContent('disconnected')
    expect(screen.getByRole('status', { name: 'loss' })).toHaveTextContent(
      'Связь с комнатой потеряна и не восстановилась. retry=true as=Anna',
    )
    expect(screen.getByRole('status', { name: 'participants' })).toBeEmptyDOMElement()
  })

  it('does not offer to retry after being removed from the room', async () => {
    const room = await renderConnected()
    act(() => {
      room.emit('disconnected', DisconnectReason.PARTICIPANT_REMOVED)
    })

    expect(screen.getByRole('status', { name: 'loss' })).toHaveTextContent(
      'Вас удалили из комнаты. retry=false',
    )
  })

  it('treats a client-initiated disconnect as leaving', async () => {
    const room = await renderConnected()
    act(() => {
      room.emit('disconnected', DisconnectReason.CLIENT_INITIATED)
    })

    expect(status()).toHaveTextContent('idle')
    expect(screen.getByRole('status', { name: 'loss' })).toBeEmptyDOMElement()
  })
})
