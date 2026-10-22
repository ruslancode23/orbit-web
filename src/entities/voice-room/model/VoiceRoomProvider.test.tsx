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

const Probe = () => {
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

const renderConnected = async () => {
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

describe('VoiceRoomProvider audio processing', () => {
  const ProcessingProbe = () => {
    const { audioProcessing, setAudioProcessing } = useVoiceRoom()
    return (
      <>
        <output aria-label="noise">{String(audioProcessing.noiseSuppression)}</output>
        <button
          type="button"
          onClick={() => void setAudioProcessing({ ...audioProcessing, noiseSuppression: false })}
        >
          noise off
        </button>
      </>
    )
  }

  const renderWithProcessing = () => {
    render(
      <VoiceRoomProvider>
        <Probe />
        <ProcessingProbe />
      </VoiceRoomProvider>,
    )
  }

  afterEach(() => {
    localStorage.clear()
  })

  it('captures with all of the browser processing on by default', async () => {
    renderWithProcessing()
    await userEvent.click(screen.getByRole('button', { name: 'connect' }))

    expect(fakeLiveKit.lastRoom().options.audioCaptureDefaults).toMatchObject({
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
    })
  })

  it('restarts the running microphone on the same device and keeps the choice for the next room', async () => {
    renderWithProcessing()
    await userEvent.click(screen.getByRole('button', { name: 'connect' }))
    const room = fakeLiveKit.lastRoom()
    room.activeDevices.audioinput = 'usb-mic'

    await userEvent.click(screen.getByRole('button', { name: 'noise off' }))

    expect(room.microphoneTrack?.restartTrack).toHaveBeenCalledWith({
      noiseSuppression: false,
      echoCancellation: true,
      autoGainControl: true,
      deviceId: 'usb-mic',
    })
    expect(room.options.audioCaptureDefaults).toMatchObject({ noiseSuppression: false })
    expect(screen.getByRole('status', { name: 'noise' })).toHaveTextContent('false')

    await userEvent.click(screen.getByRole('button', { name: 'connect' }))
    expect(fakeLiveKit.lastRoom()).not.toBe(room)
    expect(fakeLiveKit.lastRoom().options.audioCaptureDefaults).toMatchObject({
      noiseSuppression: false,
    })
  })

  it('remembers the choice on this device before any call', async () => {
    renderWithProcessing()
    await userEvent.click(screen.getByRole('button', { name: 'noise off' }))

    expect(fakeLiveKit.rooms).toHaveLength(0)
    expect(localStorage.getItem('orbit.voice.noise-suppression')).toBe('false')
  })
})
