import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { useVoiceRoom, VoiceRoomProvider } from '@/entities/voice-room'
import {
  createFakePlatform,
  FakeMediaStreamTrack,
  fakeLiveKit,
  fakeScreenCapture,
  renderWithProviders,
} from '@/shared/lib/test'
import { setPlatform } from '@/shared/platform'

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

let platform: ReturnType<typeof createFakePlatform>

beforeEach(() => {
  fakeLiveKit.reset()
  platform = createFakePlatform()
  setPlatform(platform)
})

afterEach(() => {
  setPlatform(null)
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

  it('captures the screen with system audio through the platform and stops at once', async () => {
    const capture = fakeScreenCapture({ audio: true })
    platform.screenCapture.capture.mockResolvedValueOnce(capture)
    const room = await renderConnected()

    await userEvent.click(await screen.findByRole('button', { name: 'Показать экран' }))

    expect(platform.screenCapture.capture).toHaveBeenCalledWith({ audio: true })
    expect(room.localParticipant.publishTrack).toHaveBeenCalledWith(capture.video, {
      source: 'screen_share',
    })
    expect(room.localParticipant.publishTrack).toHaveBeenCalledWith(capture.audio, {
      source: 'screen_share_audio',
    })
    expect(screen.getByText('Вы показываете экран')).toBeInTheDocument()
    const stop = screen.getByRole('button', { name: 'Остановить показ' })
    expect(stop).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(stop)

    expect(room.localParticipant.setScreenShareEnabled).toHaveBeenLastCalledWith(false)
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

  it('publishes only the video when the platform gives no audio', async () => {
    platform.screenCapture.capture.mockResolvedValueOnce({
      video: new FakeMediaStreamTrack('video'),
      audio: null,
    })
    const room = await renderConnected()

    await userEvent.click(await screen.findByRole('button', { name: 'Показать экран' }))

    expect(room.localParticipant.publishTrack).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Вы показываете экран')).toBeInTheDocument()
  })

  it('stays silent when the picker is closed', async () => {
    platform.screenCapture.capture.mockRejectedValueOnce(
      new DOMException('Permission denied', 'NotAllowedError'),
    )
    const room = await renderConnected()

    await userEvent.click(await screen.findByRole('button', { name: 'Показать экран' }))

    expect(room.localParticipant.publishTrack).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Показать экран' })).toBeEnabled()
  })

  it('explains that the platform cannot share a screen', async () => {
    platform.screenCapture.capture.mockRejectedValueOnce(
      new DOMException('Not supported', 'NotSupportedError'),
    )
    await renderConnected()

    await userEvent.click(await screen.findByRole('button', { name: 'Показать экран' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Этот браузер не умеет показывать экран.')
  })

  it('frees the capture when publishing fails', async () => {
    const video = new FakeMediaStreamTrack('video')
    const audio = new FakeMediaStreamTrack('audio')
    platform.screenCapture.capture.mockResolvedValueOnce({ video, audio })
    fakeLiveKit.publishError = new Error('negotiation failed')
    const room = await renderConnected()

    await userEvent.click(await screen.findByRole('button', { name: 'Показать экран' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось начать показ экрана.')
    expect(room.localParticipant.setScreenShareEnabled).toHaveBeenCalledWith(false)
    expect(video.stop).toHaveBeenCalled()
    expect(audio.stop).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Показать экран' })).toBeInTheDocument()
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
