import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { useVoiceRoom, VoiceRoomProvider } from '@/entities/voice-room'
import { fakeLiveKit, renderWithProviders } from '@/shared/lib/test'

import { AudioProcessingSettings } from './AudioProcessingSettings'

import type * as LiveKit from 'livekit-client'

vi.mock('livekit-client', async (importOriginal) => ({
  ...(await importOriginal<typeof LiveKit>()),
  Room: (await import('@/shared/lib/test')).FakeRoom,
}))

const Connect = () => {
  const { join } = useVoiceRoom()
  return (
    <button type="button" onClick={() => void join({ url: 'ws://lk.test', token: 'jwt' })}>
      connect
    </button>
  )
}

const renderSettings = async () => {
  renderWithProviders(
    <VoiceRoomProvider>
      <Connect />
      <AudioProcessingSettings />
    </VoiceRoomProvider>,
  )
  return screen.findByRole('switch', { name: 'Шумоподавление' })
}

beforeEach(() => {
  fakeLiveKit.reset()
})

afterEach(() => {
  localStorage.clear()
})

it('starts with all of the browser processing on', async () => {
  await renderSettings()

  for (const name of ['Шумоподавление', 'Эхоподавление', 'Автоматическая громкость']) {
    expect(screen.getByRole('switch', { name })).toBeChecked()
  }
})

it('switches processing off in the running call and keeps it after a reload', async () => {
  const noise = await renderSettings()
  await userEvent.click(screen.getByRole('button', { name: 'connect' }))

  await userEvent.click(noise)

  expect(noise).not.toBeChecked()
  expect(fakeLiveKit.lastRoom().microphoneTrack?.restartTrack).toHaveBeenCalledWith(
    expect.objectContaining({ noiseSuppression: false }),
  )
  expect(localStorage.getItem('orbit.voice.noise-suppression')).toBe('false')
})

it('says so when the microphone could not take the change', async () => {
  const noise = await renderSettings()
  await userEvent.click(screen.getByRole('button', { name: 'connect' }))
  const track = fakeLiveKit.lastRoom().microphoneTrack
  if (!track) {
    throw new Error('the microphone was not published')
  }
  vi.mocked(track.restartTrack).mockRejectedValueOnce(new Error('device busy'))

  await userEvent.click(noise)

  expect(await screen.findByText('Не удалось применить настройку к микрофону.')).toBeVisible()
})
