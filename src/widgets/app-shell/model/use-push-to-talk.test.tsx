import { act, fireEvent, render, screen } from '@testing-library/react'

import { useVoiceRoom, VoiceRoomProvider } from '@/entities/voice-room'
import { fakeLiveKit } from '@/shared/lib/test'

import { usePushToTalk } from './use-push-to-talk'

import type * as LiveKit from 'livekit-client'

vi.mock('livekit-client', async (importOriginal) => ({
  ...(await importOriginal<typeof LiveKit>()),
  Room: (await import('@/shared/lib/test')).FakeRoom,
  createLocalAudioTrack: (await import('@/shared/lib/test')).fakeCreateLocalAudioTrack,
}))

const Shell = () => {
  usePushToTalk()
  const { isPushToTalkHeld } = useVoiceRoom()
  return (
    <>
      <textarea aria-label="Сообщение" />
      <output aria-label="held">{String(isPushToTalkHeld)}</output>
    </>
  )
}

const renderShell = async () => {
  render(
    <VoiceRoomProvider>
      <Shell />
    </VoiceRoomProvider>,
  )
  return screen.findByRole('status', { name: 'held' })
}

beforeEach(() => {
  fakeLiveKit.reset()
  localStorage.setItem('orbit.voice.input-mode', 'push-to-talk')
})

afterEach(() => {
  localStorage.clear()
})

it('holds while the key is down and lets go on keyup', async () => {
  const held = await renderShell()

  const down = fireEvent.keyDown(document.body, { code: 'Backquote', key: '`' })
  expect(down).toBe(false) // default prevented: nothing is typed or scrolled
  expect(held).toHaveTextContent('true')

  vi.useFakeTimers()
  try {
    fireEvent.keyUp(document.body, { code: 'Backquote', key: '`' })
    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(held).toHaveTextContent('false')
  } finally {
    vi.useRealTimers()
  }
})

it('lets a printable key type in a text field', async () => {
  const held = await renderShell()
  const field = screen.getByRole('textbox', { name: 'Сообщение' })

  const down = fireEvent.keyDown(field, { code: 'Backquote', key: '`' })

  expect(down).toBe(true)
  expect(held).toHaveTextContent('false')
})

it('works while typing when the key types nothing', async () => {
  localStorage.setItem('orbit.voice.push-to-talk-key', 'ShiftLeft')
  const held = await renderShell()

  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Сообщение' }), {
    code: 'ShiftLeft',
    key: 'Shift',
  })

  expect(held).toHaveTextContent('true')
})

it('lets go at once when the window loses focus', async () => {
  const held = await renderShell()
  fireEvent.keyDown(document.body, { code: 'Backquote', key: '`' })

  fireEvent.blur(window)

  expect(held).toHaveTextContent('false')
})

it('ignores the key in voice activity mode', async () => {
  localStorage.setItem('orbit.voice.input-mode', 'voice-activity')
  const held = await renderShell()

  const down = fireEvent.keyDown(document.body, { code: 'Backquote', key: '`' })

  expect(down).toBe(true)
  expect(held).toHaveTextContent('false')
})
