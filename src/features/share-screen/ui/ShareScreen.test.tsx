import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { useVoiceRoom, VoiceRoomProvider } from '@/entities/voice-room'
import { fakeLiveKit, renderWithProviders } from '@/shared/lib/test'

import { ScreenShares } from './ScreenShares'
import { ShareScreenButton } from './ShareScreenButton'

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
      <ShareScreenButton />
      <ScreenShares />
    </VoiceRoomProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'connect' }))
  return fakeLiveKit.lastRoom()
}

function remoteScreenTrack(sid: string) {
  return { sid, kind: 'video', attach: vi.fn(), detach: vi.fn(() => []) }
}

beforeEach(() => {
  fakeLiveKit.reset()
})

describe('share screen', () => {
  it('is not offered before joining a room', () => {
    renderWithProviders(
      <VoiceRoomProvider>
        <ShareScreenButton />
      </VoiceRoomProvider>,
    )

    expect(screen.queryByRole('button', { name: 'Показать экран' })).not.toBeInTheDocument()
  })

  it('starts with system audio and stops at once', async () => {
    const room = await renderConnected()

    await userEvent.click(await screen.findByRole('button', { name: 'Показать экран' }))

    expect(room.localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(true, { audio: true })
    expect(screen.getByText('Вы показываете экран')).toBeInTheDocument()
    const stop = screen.getByRole('button', { name: 'Остановить показ' })
    expect(stop).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(stop)

    expect(room.localParticipant.setScreenShareEnabled).toHaveBeenLastCalledWith(false, {
      audio: true,
    })
    expect(screen.getByRole('button', { name: 'Показать экран' })).toBeInTheDocument()
    expect(screen.queryByText('Вы показываете экран')).not.toBeInTheDocument()
  })

  it('follows the browser stopping the share with its own button', async () => {
    const room = await renderConnected()
    await userEvent.click(await screen.findByRole('button', { name: 'Показать экран' }))

    // LiveKit unpublishes the screen track when the browser ends it.
    act(() => {
      room.localParticipant.isScreenShareEnabled = false
      room.emit('localTrackUnpublished', { source: 'screen_share' })
    })

    expect(screen.getByRole('button', { name: 'Показать экран' })).toBeInTheDocument()
  })

  it('stays silent when the picker is closed', async () => {
    fakeLiveKit.screenError = new DOMException('Permission denied', 'NotAllowedError')
    await renderConnected()

    await userEvent.click(await screen.findByRole('button', { name: 'Показать экран' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Показать экран' })).toBeEnabled()
  })

  it('shows and removes a remote participant screen', async () => {
    const room = await renderConnected()
    const track = remoteScreenTrack('TR_screen')

    act(() => {
      room.emit(
        'trackSubscribed',
        track,
        { source: 'screen_share' },
        { identity: 'guest-bob', name: 'Bob' },
      )
    })

    expect(screen.getByText('Bob показывает экран')).toBeInTheDocument()
    expect(track.attach).toHaveBeenCalledWith(screen.getByLabelText('Экран: Bob'))

    act(() => {
      room.emit('trackUnsubscribed', track)
    })

    expect(screen.queryByText('Bob показывает экран')).not.toBeInTheDocument()
  })

  it('ignores a remote camera track', async () => {
    const room = await renderConnected()

    act(() => {
      room.emit(
        'trackSubscribed',
        remoteScreenTrack('TR_cam'),
        { source: 'camera' },
        { identity: 'b', name: 'Bob' },
      )
    })

    expect(screen.queryByRole('region', { name: 'Демонстрации экрана' })).not.toBeInTheDocument()
  })
})
