import { QueryClient } from '@tanstack/react-query'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LiveProvider } from '@/entities/live'
import {
  getUserProfileQueryKey,
  listFriendRequestsQueryKey,
  listFriendsQueryKey,
  type Friend,
  type FriendRequest,
  type UserProfile,
} from '@/shared/api'
import { renderWithProviders } from '@/shared/lib/test'

import { FriendActionSlot } from './FriendActionSlot'

/** A socket the test talks through when it needs a live frame. */
class FakeSocket {
  static readonly OPEN = 1
  readyState = 0
  private listeners = new Map<string, ((event: unknown) => void)[]>()

  constructor() {
    sockets.push(this)
  }

  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  send() {
    return undefined
  }

  close() {
    return undefined
  }

  receive(frame: object) {
    for (const listener of this.listeners.get('message') ?? []) {
      listener(new MessageEvent('message', { data: JSON.stringify(frame) }))
    }
  }
}

const sockets: FakeSocket[] = []

const bob: UserProfile = {
  id: 'u-bob',
  nickname: 'bob',
  displayName: 'Боб',
  accentColor: 'teal',
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-09-02T10:00:00Z'),
}

const friendship: Friend = {
  id: bob.id,
  nickname: bob.nickname,
  presence: 'online',
  since: new Date('2026-10-20T10:00:00Z'),
}

const outgoingRequest: FriendRequest = {
  userId: bob.id,
  nickname: bob.nickname,
  direction: 'outgoing',
  createdAt: new Date('2026-10-20T10:00:00Z'),
}

const incomingRequest: FriendRequest = {
  userId: bob.id,
  nickname: bob.nickname,
  direction: 'incoming',
  createdAt: new Date('2026-10-20T10:00:00Z'),
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )

const noContent = () => Promise.resolve(new Response(null, { status: 204 }))

interface ServerState {
  friends: Friend[]
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
}

/** Answers the lists from mutable state, so a mutation can change what is true. */
const stubApi = (state: ServerState) => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      if (url.pathname === '/api/v1/friends') {
        return json(state.friends)
      }
      if (url.pathname === '/api/v1/friends/requests') {
        if (request.method === 'GET') {
          return json(
            url.searchParams.get('direction') === 'incoming' ? state.incoming : state.outgoing,
          )
        }
        // The stored request appears in the outgoing list afterwards.
        state.outgoing = [outgoingRequest]
        return json({ message: 'If such a user exists, they will receive your request.' }, 202)
      }
      if (url.pathname.endsWith('/accept')) {
        state.friends = [friendship]
        state.incoming = []
        return json(friendship)
      }
      if (url.pathname.startsWith('/api/v1/friends/requests/')) {
        state.outgoing = []
        return noContent()
      }
      if (url.pathname.startsWith('/api/v1/friends/')) {
        state.friends = []
        return noContent()
      }
      return json({})
    }),
  )
}

const createClient = (state: ServerState) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  })
  client.setQueryData(getUserProfileQueryKey({ path: { userId: bob.id } }), bob)
  client.setQueryData(listFriendsQueryKey(), state.friends)
  client.setQueryData(
    listFriendRequestsQueryKey({ query: { direction: 'incoming' } }),
    state.incoming,
  )
  client.setQueryData(
    listFriendRequestsQueryKey({ query: { direction: 'outgoing' } }),
    state.outgoing,
  )
  return client
}

const renderSlot = (state: ServerState) => {
  stubApi(state)
  const queryClient = createClient(state)
  return renderWithProviders(<FriendActionSlot userId={bob.id} />, { queryClient })
}

afterEach(() => {
  sockets.length = 0
  vi.unstubAllGlobals()
})

it('offers to add a stranger', () => {
  renderSlot({ friends: [], incoming: [], outgoing: [] })

  expect(screen.getByRole('button', { name: 'Добавить в друзья' })).toBeInTheDocument()
})

it('shows a sent request with a way to cancel it', async () => {
  const state = { friends: [], incoming: [], outgoing: [outgoingRequest] }
  renderSlot(state)

  expect(screen.getByText('Заявка отправлена')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Отменить заявку' }))

  expect(await screen.findByRole('button', { name: 'Добавить в друзья' })).toBeInTheDocument()
})

it('answers an incoming request', async () => {
  const state = { friends: [], incoming: [incomingRequest], outgoing: [] }
  renderSlot(state)

  await userEvent.click(screen.getByRole('button', { name: 'Принять заявку' }))

  expect(await screen.findByRole('button', { name: 'Друзья' })).toBeInTheDocument()
})

it('shows friendship and removes it from the menu', async () => {
  const state = { friends: [friendship], incoming: [], outgoing: [] }
  renderSlot(state)

  await userEvent.click(screen.getByRole('button', { name: 'Друзья' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Удалить из друзей' }))

  expect(await screen.findByRole('button', { name: 'Добавить в друзья' })).toBeInTheDocument()
})

it('follows a friend.added event without a local flag', async () => {
  const state: ServerState = { friends: [], incoming: [], outgoing: [outgoingRequest] }
  stubApi(state)
  vi.stubGlobal('WebSocket', FakeSocket)
  const queryClient = createClient(state)
  renderWithProviders(
    <LiveProvider enabled>
      <FriendActionSlot userId={bob.id} />
    </LiveProvider>,
    { queryClient },
  )

  expect(screen.getByText('Заявка отправлена')).toBeInTheDocument()

  state.outgoing = []
  state.friends = [friendship]
  act(() => {
    sockets[0]?.receive({
      type: 'friend.added',
      payload: {
        id: bob.id,
        nickname: bob.nickname,
        presence: 'online',
        since: '2026-10-20T10:00:00Z',
      },
    })
  })

  expect(await screen.findByRole('button', { name: 'Друзья' })).toBeInTheDocument()
})

it('sends the neutral answer and waits for the list before claiming a request', async () => {
  const state = { friends: [], incoming: [], outgoing: [] }
  renderSlot(state)

  await userEvent.click(screen.getByRole('button', { name: 'Добавить в друзья' }))

  expect(
    await screen.findByText('Если такой пользователь есть, он получит заявку'),
  ).toBeInTheDocument()
  expect(await screen.findByText('Заявка отправлена')).toBeInTheDocument()
})

it('reports a failed request instead of leaving it looking sent', async () => {
  const state = { friends: [], incoming: [], outgoing: [] }
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(json({ error: { code: 'server_error', message: 'нет' } }, 500))),
  )
  const queryClient = createClient(state)
  renderWithProviders(<FriendActionSlot userId={bob.id} />, { queryClient })

  await userEvent.click(screen.getByRole('button', { name: 'Добавить в друзья' }))

  expect(await screen.findByText('нет')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Добавить в друзья' })).toBeInTheDocument()
  await waitFor(() => {
    expect(screen.queryByText('Заявка отправлена')).not.toBeInTheDocument()
  })
})
