import { act, renderHook } from '@testing-library/react'

import { setPresenceChoice } from '@/entities/live'

import { useNotificationsMuted } from './mute'

beforeEach(() => {
  setPresenceChoice('auto')
})

it('is quiet only in «Не беспокоить»', () => {
  const { result } = renderHook(() => useNotificationsMuted())

  for (const status of ['auto', 'online', 'idle', 'invisible'] as const) {
    act(() => {
      setPresenceChoice(status)
    })
    expect(result.current).toBe(false)
  }

  act(() => {
    setPresenceChoice('dnd')
  })
  expect(result.current).toBe(true)
})
