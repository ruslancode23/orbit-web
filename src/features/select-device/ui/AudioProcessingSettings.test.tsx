import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { useVoiceRoom, VoiceRoomProvider } from '@/entities/voice-room'
import { fakeLiveKit, renderWithProviders } from '@/shared/lib/test'

import { AudioProcessingSettings } from './AudioProcessingSettings'

import type * as LiveKit from 'livekit-client'

vi.mock('@/entities/voice-room/lib/rnnoise', () => ({
  attachRnnoise: vi.fn(() => Promise.resolve()),
  detachRnnoise: vi.fn(() => Promise.resolve()),
}))

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
  return screen.findByRole('switch', { name: 'Эхоподавление' })
}

beforeEach(() => {
  fakeLiveKit.reset()
})

afterEach(() => {
  localStorage.clear()
})

it('starts with the standard suppression and the rest of the browser processing on', async () => {
  await renderSettings()

  expect(screen.getByRole('radio', { name: /Стандартное/ })).toBeChecked()
  for (const name of ['Эхоподавление', 'Автоматическая громкость']) {
    expect(screen.getByRole('switch', { name })).toBeChecked()
  }
})

it('switches processing off in the running call and keeps it after a reload', async () => {
  const echo = await renderSettings()
  await userEvent.click(screen.getByRole('button', { name: 'connect' }))

  await userEvent.click(echo)

  expect(echo).not.toBeChecked()
  expect(fakeLiveKit.lastRoom().microphoneTrack?.restartTrack).toHaveBeenCalledWith(
    expect.objectContaining({ echoCancellation: false }),
  )
  expect(localStorage.getItem('orbit.voice.echo-cancellation')).toBe('false')
})

it('picks the enhanced suppression and remembers it', async () => {
  await renderSettings()

  await userEvent.click(screen.getByRole('radio', { name: /Усиленное/ }))

  expect(screen.getByRole('radio', { name: /Усиленное/ })).toBeChecked()
  expect(localStorage.getItem('orbit.voice.enhanced-noise-suppression')).toBe('true')

  await userEvent.click(screen.getByRole('radio', { name: /Выключено/ }))
  expect(localStorage.getItem('orbit.voice.noise-suppression')).toBe('false')
  expect(localStorage.getItem('orbit.voice.enhanced-noise-suppression')).toBe('false')
})

it('says so when the microphone could not take the change', async () => {
  const echo = await renderSettings()
  await userEvent.click(screen.getByRole('button', { name: 'connect' }))
  const track = fakeLiveKit.lastRoom().microphoneTrack
  if (!track) {
    throw new Error('the microphone was not published')
  }
  vi.mocked(track.restartTrack).mockRejectedValueOnce(new Error('device busy'))

  await userEvent.click(echo)

  expect(await screen.findByText('Не удалось применить настройку к микрофону.')).toBeVisible()
})
