import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/shared/lib/test'

import { JoinRoom } from './JoinRoom'

import type * as LiveKit from 'livekit-client'

type Handler = (...args: unknown[]) => void

// `micError` makes the next Room fail to publish the microphone.
const fake = vi.hoisted(() => ({ rooms: [] as FakeRoom[], micError: null as Error | null }))
const { rooms } = fake

interface FakeRoom {
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  startAudio: ReturnType<typeof vi.fn>
  localParticipant: {
    identity: string
    name: string
    setMicrophoneEnabled: ReturnType<typeof vi.fn>
  }
  remoteParticipants: Map<string, { identity: string; name: string }>
  emit: (event: string, ...args: unknown[]) => void
}

vi.mock('livekit-client', async (importOriginal) => {
  const actual = await importOriginal<typeof LiveKit>()

  class Room implements FakeRoom {
    private handlers = new Map<string, Handler[]>()
    localParticipant = {
      identity: 'guest-me',
      name: '',
      setMicrophoneEnabled: vi.fn(() =>
        fake.micError ? Promise.reject(fake.micError) : Promise.resolve(),
      ),
    }
    remoteParticipants = new Map<string, { identity: string; name: string }>()
    connect = vi.fn(() => {
      this.localParticipant.name = 'Anna'
      return Promise.resolve()
    })
    startAudio = vi.fn(() => Promise.resolve())
    disconnect = vi.fn(() => {
      this.emit('disconnected')
      return Promise.resolve()
    })

    constructor() {
      rooms.push(this)
    }

    on(event: string, handler: Handler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
      return this
    }

    emit(event: string, ...args: unknown[]) {
      for (const handler of this.handlers.get(event) ?? []) handler(...args)
    }
  }

  return { ...actual, Room }
})

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  rooms.length = 0
  fake.micError = null
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

function lastRoom(): FakeRoom {
  const room = rooms.at(-1)
  if (!room) throw new Error('no Room was created')
  return room
}

async function joinAs(name: string) {
  await userEvent.type(screen.getByLabelText('Ваше имя'), name)
  await userEvent.click(screen.getByRole('button', { name: 'Войти в комнату' }))
}

describe('JoinRoom', () => {
  it('gets a token, connects to LiveKit and publishes the microphone', async () => {
    renderWithProviders(<JoinRoom room="dev-room" />)

    await joinAs('  Anna ')

    expect(await screen.findByText('Вы в комнате')).toBeInTheDocument()
    const request = fetchMock.mock.calls[0]?.[0] as Request
    expect(await request.json()).toEqual({ room: 'dev-room', displayName: 'Anna' })
    const room = lastRoom()
    expect(room.connect).toHaveBeenCalledWith('ws://lk.test', 'jwt')
    expect(room.startAudio).toHaveBeenCalled()
    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true)
    expect(screen.getByRole('list', { name: 'Участники' })).toHaveTextContent('Anna (вы)')
  })

  it('shows remote participants and plays their audio', async () => {
    const { container } = renderWithProviders(<JoinRoom room="dev-room" />)
    await joinAs('Anna')
    await screen.findByText('Вы в комнате')
    const room = lastRoom()

    const audio = document.createElement('audio')
    act(() => {
      room.remoteParticipants.set('guest-bob', { identity: 'guest-bob', name: 'Bob' })
      room.emit('participantConnected')
      room.emit('trackSubscribed', { kind: 'audio', attach: () => audio, detach: () => [audio] })
    })

    expect(screen.getByRole('list', { name: 'Участники' })).toHaveTextContent('Bob')
    expect(container.contains(audio)).toBe(true)

    act(() => {
      room.emit('trackUnsubscribed', { kind: 'audio', detach: () => [audio] })
    })
    expect(container.contains(audio)).toBe(false)
  })

  it('leaves the room and releases the microphone', async () => {
    renderWithProviders(<JoinRoom room="dev-room" />)
    await joinAs('Anna')
    await screen.findByText('Вы в комнате')

    await userEvent.click(screen.getByRole('button', { name: 'Выйти' }))

    expect(lastRoom().disconnect).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Войти в комнату' })).toBeInTheDocument()
  })

  it('disconnects when the page goes away', async () => {
    const { unmount } = renderWithProviders(<JoinRoom room="dev-room" />)
    await joinAs('Anna')
    await screen.findByText('Вы в комнате')

    unmount()

    expect(lastRoom().disconnect).toHaveBeenCalled()
  })

  it('explains a denied microphone and does not stay connected', async () => {
    fake.micError = new DOMException('Permission denied', 'NotAllowedError')
    renderWithProviders(<JoinRoom room="dev-room" />)

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
    renderWithProviders(<JoinRoom room="dev-room" />)

    await joinAs('Anna')

    expect(await screen.findByRole('alert')).toHaveTextContent('Имя слишком длинное')
    expect(rooms).toHaveLength(0)
  })

  it('does not submit an empty name', async () => {
    renderWithProviders(<JoinRoom room="dev-room" />)

    await userEvent.type(screen.getByLabelText('Ваше имя'), '   ')

    expect(screen.getByRole('button', { name: 'Войти в комнату' })).toBeDisabled()
    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
