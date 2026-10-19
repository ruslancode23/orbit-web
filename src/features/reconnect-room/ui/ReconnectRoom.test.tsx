import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DisconnectReason } from 'livekit-client'

import { useVoiceRoom, VoiceRoomProvider } from '@/entities/voice-room'
import { fakeLiveKit, renderWithProviders } from '@/shared/lib/test'

import { ReconnectRoom } from './ReconnectRoom'

import type * as LiveKit from 'livekit-client'

vi.mock('livekit-client', async (importOriginal) => ({
  ...(await importOriginal<typeof LiveKit>()),
  Room: (await import('@/shared/lib/test')).FakeRoom,
}))

const fetchMock = vi.fn<typeof fetch>()

const tokenResponse = () => {
  return new Response(
    JSON.stringify({
      token: 'fresh-jwt',
      url: 'ws://lk.test',
      identity: 'guest-me',
      expiresAt: '2026-10-16T12:10:00Z',
    }),
    { status: 201, headers: { 'Content-Type': 'application/json' } },
  )
}

beforeEach(() => {
  fakeLiveKit.reset()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation(() => Promise.resolve(tokenResponse()))
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const Connect = () => {
  const { join } = useVoiceRoom()
  return (
    <button type="button" onClick={() => void join({ url: 'ws://lk.test', token: 'jwt' })}>
      connect
    </button>
  )
}

const renderConnected = async () => {
  renderWithProviders(
    <VoiceRoomProvider>
      <Connect />
      <ReconnectRoom room="dev-room" />
    </VoiceRoomProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'connect' }))
  return fakeLiveKit.lastRoom()
}

const loseRoom = (reason: DisconnectReason) => {
  const room = fakeLiveKit.lastRoom()
  act(() => {
    room.emit('reconnecting')
    room.emit('disconnected', reason)
  })
}

describe('reconnect room', () => {
  it('shows nothing while connected', async () => {
    await renderConnected()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says it is reconnecting while LiveKit retries, and goes away when it is back', async () => {
    const room = await renderConnected()

    act(() => {
      room.emit('reconnecting')
    })
    expect(screen.getByRole('status')).toHaveTextContent('Связь прервалась')

    act(() => {
      room.emit('reconnected')
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('offers to join again with a fresh token when reconnecting fails', async () => {
    await renderConnected()
    loseRoom(DisconnectReason.SIGNAL_CLOSE)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Связь с комнатой потеряна и не восстановилась.')

    await userEvent.click(screen.getByRole('button', { name: 'Переподключиться' }))

    const request = fetchMock.mock.calls.at(-1)?.[0]
    if (!(request instanceof Request)) {
      throw new Error('no token request')
    }
    expect(await request.json()).toEqual({ room: 'dev-room', displayName: 'Anna' })

    const rejoined = fakeLiveKit.lastRoom()
    expect(fakeLiveKit.rooms).toHaveLength(2)
    expect(rejoined.connect).toHaveBeenCalledWith('ws://lk.test', 'fresh-jwt')
    expect(rejoined.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the retry when the server cannot be reached', async () => {
    await renderConnected()
    loseRoom(DisconnectReason.SIGNAL_CLOSE)
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await userEvent.click(screen.getByRole('button', { name: 'Переподключиться' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Нет соединения с сервером.')
    expect(screen.getByRole('button', { name: 'Переподключиться' })).toBeEnabled()
    expect(fakeLiveKit.rooms).toHaveLength(1)
  })

  it('does not offer a retry that cannot help', async () => {
    await renderConnected()
    loseRoom(DisconnectReason.PARTICIPANT_REMOVED)

    expect(screen.getByRole('alert')).toHaveTextContent('Вас удалили из комнаты.')
    expect(screen.queryByRole('button', { name: 'Переподключиться' })).not.toBeInTheDocument()
  })

  it('shows nothing after the user leaves', async () => {
    const room = await renderConnected()

    await act(() => room.disconnect())

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
