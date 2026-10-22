import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { VoiceRoomProvider } from '@/entities/voice-room'
import { fakeLiveKit, renderWithProviders } from '@/shared/lib/test'

import { InputModeSettings } from './InputModeSettings'

import type * as LiveKit from 'livekit-client'

vi.mock('livekit-client', async (importOriginal) => ({
  ...(await importOriginal<typeof LiveKit>()),
  Room: (await import('@/shared/lib/test')).FakeRoom,
}))

const renderSettings = () => {
  renderWithProviders(
    <VoiceRoomProvider>
      <InputModeSettings />
    </VoiceRoomProvider>,
  )
  return screen.findByRole('radio', { name: /По нажатию клавиши/ })
}

beforeEach(() => {
  fakeLiveKit.reset()
})

afterEach(() => {
  localStorage.clear()
})

it('starts with voice activity and shows the key only for push-to-talk', async () => {
  const byKey = await renderSettings()

  expect(screen.getByRole('radio', { name: /Голосовая активация/ })).toBeChecked()
  expect(screen.queryByRole('button', { name: 'Изменить клавишу' })).not.toBeInTheDocument()

  await userEvent.click(byKey)

  expect(byKey).toBeChecked()
  expect(screen.getByText('`')).toBeVisible()
  expect(screen.getByText(/пока вкладка Orbit открыта и активна/)).toBeVisible()
  expect(localStorage.getItem('orbit.voice.input-mode')).toBe('push-to-talk')
})

it('takes the next key pressed as the new key', async () => {
  await userEvent.click(await renderSettings())

  await userEvent.click(screen.getByRole('button', { name: 'Изменить клавишу' }))
  expect(screen.getByRole('button', { name: 'Нажмите клавишу…' })).toHaveFocus()
  await userEvent.keyboard('v')

  expect(screen.getByText('V')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Изменить клавишу' })).toBeVisible()
  expect(localStorage.getItem('orbit.voice.push-to-talk-key')).toBe('KeyV')
})

it('keeps the key on Esc and refuses keys the interface needs', async () => {
  await userEvent.click(await renderSettings())
  await userEvent.click(screen.getByRole('button', { name: 'Изменить клавишу' }))

  await userEvent.keyboard('{Tab}')
  expect(screen.getByRole('alert')).toHaveTextContent('Tab занята интерфейсом')
  expect(screen.getByRole('button', { name: 'Нажмите клавишу…' })).toHaveFocus()

  await userEvent.keyboard('{Escape}')
  expect(screen.getByRole('button', { name: 'Изменить клавишу' })).toBeVisible()
  expect(screen.getByText('`')).toBeVisible()
  expect(localStorage.getItem('orbit.voice.push-to-talk-key')).toBeNull()
})
