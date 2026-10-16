import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { VoiceRoomProvider } from '@/entities/voice-room'
import { fakeLiveKit, fakeRemoteParticipant, renderWithProviders } from '@/shared/lib/test'

import { JoinRoom } from './JoinRoom'

import type * as LiveKit from 'livekit-client'

vi.mock('livekit-client', async (importOriginal) => ({
  ...(await importOriginal<typeof LiveKit>()),
  Room: (await import('@/shared/lib/test')).FakeRoom,
}))

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fakeLiveKit.reset()
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        token: 'jwt',
        url: 'ws://lk.test',
        identity: 'guest-me',
        expiresAt: '2026-10-16T12:10:00Z',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    ),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

const lastRoom = () => fakeLiveKit.lastRoom()

function renderJoinRoom() {
  return renderWithProviders(
    <VoiceRoomProvider>
      <JoinRoom room="dev-room" />
    </VoiceRoomProvider>,
  )
}

async function joinAs(name: string) {
  await userEvent.type(screen.getByLabelText('Ваше имя'), name)
  await userEvent.click(screen.getByRole('button', { name: 'Войти в комнату' }))
}

describe('JoinRoom', () => {
  it('gets a token, connects to LiveKit and publishes the microphone', async () => {
    renderJoinRoom()

    await joinAs('  Anna ')

    expect(await screen.findByText('Вы в комнате')).toBeInTheDocument()
    const request = fetchMock.mock.calls[0]?.[0] as Request
    expect(await request.json()).toEqual({ room: 'dev-room', displayName: 'Anna' })
    const room = lastRoom()
    expect(room.connect).toHaveBeenCalledWith('ws://lk.test', 'jwt')
    expect(room.startAudio).toHaveBeenCalled()
    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true)
  })

  it('plays remote participants audio', async () => {
    const { container } = renderJoinRoom()
    await joinAs('Anna')
    await screen.findByText('Вы в комнате')
    const room = lastRoom()

    const audio = document.createElement('audio')
    act(() => {
      const bob = fakeRemoteParticipant('guest-bob', 'Bob')
      room.remoteParticipants.set(bob.identity, bob)
      room.emit('participantConnected', bob)
      room.emit(
        'trackSubscribed',
        { kind: 'audio', attach: () => audio, detach: () => [audio] },
        {},
        {},
      )
    })

    expect(container.contains(audio)).toBe(true)

    act(() => {
      room.emit('trackUnsubscribed', { kind: 'audio', detach: () => [audio] })
    })
    expect(container.contains(audio)).toBe(false)
  })

  it('leaves the room and releases the microphone', async () => {
    renderJoinRoom()
    await joinAs('Anna')
    await screen.findByText('Вы в комнате')

    await userEvent.click(screen.getByRole('button', { name: 'Выйти' }))

    expect(lastRoom().disconnect).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Войти в комнату' })).toBeInTheDocument()
  })

  it('disconnects when the page goes away', async () => {
    const { unmount } = renderJoinRoom()
    await joinAs('Anna')
    await screen.findByText('Вы в комнате')

    unmount()

    expect(lastRoom().disconnect).toHaveBeenCalled()
  })

  it('explains a denied microphone and does not stay connected', async () => {
    fakeLiveKit.micError = new DOMException('Permission denied', 'NotAllowedError')
    renderJoinRoom()

    await joinAs('Anna')

    expect(await screen.findByRole('alert')).toHaveTextContent('Нет доступа к микрофону')
    expect(lastRoom().disconnect).toHaveBeenCalled()
    expect(screen.queryByText('Вы в комнате')).not.toBeInTheDocument()
  })

  it('shows the server error and never touches LiveKit', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'invalid_request', message: 'Имя слишком длинное' } }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )
    renderJoinRoom()

    await joinAs('Anna')

    expect(await screen.findByRole('alert')).toHaveTextContent('Имя слишком длинное')
    expect(fakeLiveKit.rooms).toHaveLength(0)
  })

  it('does not submit an empty name', async () => {
    renderJoinRoom()

    await userEvent.type(screen.getByLabelText('Ваше имя'), '   ')

    expect(screen.getByRole('button', { name: 'Войти в комнату' })).toBeDisabled()
    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
