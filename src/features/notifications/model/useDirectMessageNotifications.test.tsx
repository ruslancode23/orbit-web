import { QueryClient } from '@tanstack/react-query'
import { act } from '@testing-library/react'

import type * as LiveModule from '@/entities/live'
import type { LiveEvent } from '@/entities/live'
import { setPresenceChoice } from '@/entities/live'
import { getCurrentUserQueryKey } from '@/shared/api'
import { createFakePlatform, renderWithProviders } from '@/shared/lib/test'
import { setPlatform } from '@/shared/platform'

import { setConversationMuted } from './conversation-mute'
import { setNotificationMode } from './mode'
import { useDirectMessageNotifications } from './useDirectMessageNotifications'

const state = vi.hoisted(() => ({
  listeners: [] as ((event: LiveEvent) => void)[],
}))

vi.mock('@/entities/live', async (importOriginal) => {
  const actual = await importOriginal<typeof LiveModule>()
  return {
    ...actual,
    useLive: () => ({
      listen: (listener: (event: LiveEvent) => void) => {
        state.listeners.push(listener)
        return () => {
          state.listeners = state.listeners.filter((item) => item !== listener)
        }
      },
    }),
  }
})

const anna = { id: 'u-anna', nickname: 'anna', isGuest: false, createdAt: '2026-10-20T10:00:00Z' }

const messageEvent = (overrides: { channelId?: string; authorId?: string } = {}): LiveEvent => {
  const channelId = overrides.channelId ?? 'c-direct'
  return {
    type: 'message.created',
    channelId,
    payload: {
      id: 'm-1',
      channelId,
      seq: 1,
      kind: 'user',
      content: 'привет',
      mentions: [],
      reactions: [],
      author: { id: overrides.authorId ?? 'u-bob', nickname: 'Boris', isGuest: false },
      createdAt: '2026-10-20T10:00:00Z',
    },
  }
}

const Probe = () => {
  useDirectMessageNotifications()
  return null
}

const renderProbe = (route = '/me/other') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(getCurrentUserQueryKey(), anna)
  return renderWithProviders(<Probe />, { route, queryClient })
}

const emit = (event: LiveEvent) => {
  act(() => {
    for (const listener of state.listeners) {
      listener(event)
    }
  })
}

let platform: ReturnType<typeof createFakePlatform>

beforeEach(() => {
  state.listeners = []
  setPresenceChoice('auto')
  setNotificationMode('mentions')
  setConversationMuted('c-direct', false)
  platform = createFakePlatform()
  setPlatform(platform)
})

afterEach(() => {
  setPlatform(null)
  setConversationMuted('c-direct', false)
  vi.unstubAllGlobals()
})

it('notifies about every direct message, even in the mentions-only mode', () => {
  renderProbe()
  emit(messageEvent())

  expect(platform.notifications.show).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Личное сообщение',
      body: 'Boris: привет',
      tag: 'direct-c-direct',
    }),
  )
})

it('stays quiet for the dialogue that is open and visible', () => {
  renderProbe('/me/c-direct')
  emit(messageEvent())

  expect(platform.notifications.show).not.toHaveBeenCalled()
})

it('stays quiet for a dialogue whose notifications are off', () => {
  renderProbe()
  act(() => {
    setConversationMuted('c-direct', true)
  })

  emit(messageEvent())

  expect(platform.notifications.show).not.toHaveBeenCalled()
})

it('«Не беспокоить» silences direct messages as well', () => {
  renderProbe()
  act(() => {
    setPresenceChoice('dnd')
  })

  emit(messageEvent())

  expect(platform.notifications.show).not.toHaveBeenCalled()
})

it('never notifies about the reader’s own message or a system line', () => {
  renderProbe()
  emit(messageEvent({ authorId: anna.id }))
  emit({
    ...messageEvent(),
    payload: { ...(messageEvent().payload as object), kind: 'system' },
  })

  expect(platform.notifications.show).not.toHaveBeenCalled()
})
