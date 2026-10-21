import { QueryClient } from '@tanstack/react-query'
import { act } from '@testing-library/react'

import type * as LiveModule from '@/entities/live'
import type { LiveEvent } from '@/entities/live'
import { setPresenceChoice } from '@/entities/live'
import { listFriendRequestsQueryKey, type FriendRequest } from '@/shared/api'
import { createFakePlatform, renderWithProviders } from '@/shared/lib/test'
import { setPlatform } from '@/shared/platform'

import { useFriendNotifications } from './useFriendNotifications'

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

const outgoing: FriendRequest = {
  userId: 'u-bob',
  nickname: 'bob',
  direction: 'outgoing',
  createdAt: new Date('2026-10-20T10:00:00Z'),
}

const incomingEvent: LiveEvent = {
  type: 'friend.request.created',
  payload: {
    userId: 'u-eva',
    nickname: 'eva',
    direction: 'incoming',
    createdAt: '2026-10-20T10:00:00Z',
  },
}

const addedEvent: LiveEvent = {
  type: 'friend.added',
  payload: {
    id: 'u-bob',
    nickname: 'bob',
    presence: 'online',
    since: '2026-10-20T10:00:00Z',
  },
}

const Probe = () => {
  useFriendNotifications()
  return null
}

const renderProbe = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(listFriendRequestsQueryKey({ query: { direction: 'outgoing' } }), [
    outgoing,
  ])
  return renderWithProviders(<Probe />, { route: '/me', queryClient })
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
  platform = createFakePlatform()
  setPlatform(platform)
})

afterEach(() => {
  setPlatform(null)
})

it('notifies about an incoming request', () => {
  renderProbe()
  emit(incomingEvent)

  expect(platform.notifications.show).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Заявка в друзья',
      body: 'eva хочет добавить вас в друзья',
      tag: 'friend-request-u-eva',
    }),
  )
})

it('notifies when a request this account sent is accepted', () => {
  renderProbe()
  emit(addedEvent)

  expect(platform.notifications.show).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Заявка принята',
      body: 'bob теперь у вас в друзьях',
    }),
  )
})

it('is silent when the new friend was not asked by this account', () => {
  renderProbe()
  emit({
    ...addedEvent,
    payload: { ...(addedEvent.payload as object), id: 'u-carol', nickname: 'carol' },
  })

  expect(platform.notifications.show).not.toHaveBeenCalled()
})

it('«Не беспокоить» stops both kinds', () => {
  renderProbe()
  act(() => {
    setPresenceChoice('dnd')
  })

  emit(incomingEvent)
  emit(addedEvent)

  expect(platform.notifications.show).not.toHaveBeenCalled()
})
