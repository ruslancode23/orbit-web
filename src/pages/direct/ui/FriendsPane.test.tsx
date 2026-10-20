import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'

import type { BlockedUser, Friend, FriendRequest, UserProfile } from '@/shared/api'
import { renderWithProviders } from '@/shared/lib/test'

import FriendsPane from './FriendsPane'

const date = '2026-10-20T10:00:00Z'

const anna: Friend = {
  id: 'u-anna',
  nickname: 'anna',
  presence: 'online',
  since: new Date(date),
}
const bob: Friend = { id: 'u-bob', nickname: 'bob', presence: 'idle', since: new Date(date) }
const carol: Friend = { id: 'u-carol', nickname: 'carol', presence: 'dnd', since: new Date(date) }
const dina: Friend = { id: 'u-dina', nickname: 'dina', presence: 'offline', since: new Date(date) }

const profile = (
  friend: Friend,
  displayName: string,
  customStatus?: UserProfile['customStatus'],
): UserProfile => ({
  id: friend.id,
  nickname: friend.nickname,
  displayName,
  accentColor: 'violet',
  bio: '',
  isGuest: false,
  createdAt: new Date(date),
  customStatus,
})

const profiles = new Map<string, UserProfile>([
  ['u-anna', profile(anna, 'Анна', { text: 'на связи' })],
  ['u-bob', profile(bob, 'Боб')],
  ['u-carol', profile(carol, 'Кэрол')],
  ['u-dina', profile(dina, 'Дина')],
])

const incoming: FriendRequest = {
  userId: 'u-eva',
  nickname: 'eva',
  direction: 'incoming',
  createdAt: new Date(date),
}
const outgoing: FriendRequest = {
  userId: 'u-fedor',
  nickname: 'fedor',
  direction: 'outgoing',
  createdAt: new Date(date),
}
const blocked: BlockedUser = {
  id: 'u-grigoriy',
  nickname: 'grigoriy',
  createdAt: new Date(date),
}

const conversation = {
  id: 'c-new',
  kind: 'direct' as const,
  members: [],
  createdAt: date,
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const noContent = () => new Response(null, { status: 204 })

interface Call {
  method: string
  path: string
  body: string
}

interface Failure {
  method: string
  path: string
  status: number
  message: string
}

interface StubOptions {
  friends?: Friend[]
  incoming?: FriendRequest[]
  outgoing?: FriendRequest[]
  blocks?: BlockedUser[]
  failure?: Failure
}

/** Answers the friends endpoints and records what the UI asked for. */
const stubApi = ({
  friends = [anna, bob, carol, dina],
  incoming: requestsIn = [incoming],
  outgoing: requestsOut = [outgoing],
  blocks = [blocked],
  failure,
}: StubOptions = {}) => {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      const body =
        request.method === 'GET' || request.method === 'HEAD' ? '' : await request.clone().text()
      calls.push({ method: request.method, path: url.pathname, body })

      if (failure?.method === request.method && url.pathname === failure.path) {
        return json({ error: { code: 'server_error', message: failure.message } }, failure.status)
      }
      if (url.pathname === '/api/v1/friends' && request.method === 'GET') {
        return json(friends)
      }
      if (url.pathname === '/api/v1/friends/requests' && request.method === 'GET') {
        return json(url.searchParams.get('direction') === 'incoming' ? requestsIn : requestsOut)
      }
      if (url.pathname === '/api/v1/friends/requests' && request.method === 'POST') {
        return json({ message: 'If such a user exists, they will receive your request.' }, 202)
      }
      if (
        url.pathname.startsWith('/api/v1/friends/requests/') &&
        url.pathname.endsWith('/accept')
      ) {
        return json(anna)
      }
      if (url.pathname.startsWith('/api/v1/friends/requests/') && request.method === 'DELETE') {
        return noContent()
      }
      if (url.pathname.startsWith('/api/v1/friends/') && request.method === 'DELETE') {
        return noContent()
      }
      if (url.pathname === '/api/v1/users/me/blocks' && request.method === 'GET') {
        return json(blocks)
      }
      if (url.pathname.startsWith('/api/v1/users/me/blocks/')) {
        return noContent()
      }
      const id = /^\/api\/v1\/users\/([^/]+)\/profile$/u.exec(url.pathname)?.[1]
      if (id !== undefined) {
        const found = profiles.get(id)
        return found ? json(found) : json({ error: { code: 'not_found' } }, 404)
      }
      if (url.pathname === '/api/v1/conversations' && request.method === 'POST') {
        return json(conversation)
      }
      return json({})
    }),
  )
  return calls
}

const renderPane = () =>
  renderWithProviders(
    <MemoryRouter initialEntries={['/me/friends']}>
      <Routes>
        <Route path="/me/friends" element={<FriendsPane />} />
        <Route path="/me/:conversationId" element={<p>Открыт диалог</p>} />
      </Routes>
    </MemoryRouter>,
  )

const openTab = async (name: string | RegExp) => {
  await userEvent.click(screen.getByRole('tab', { name }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('shows only reachable friends in «В сети»', async () => {
  stubApi()
  renderPane()

  expect(await screen.findByText('Анна')).toBeInTheDocument()
  expect(screen.getByText('Боб')).toBeInTheDocument()
  expect(screen.getByText('Кэрол')).toBeInTheDocument()
  expect(screen.queryByText('Дина')).not.toBeInTheDocument()
  expect(screen.getByText('на связи')).toBeInTheDocument()
})

it('shows everyone in «Все»', async () => {
  stubApi()
  renderPane()
  await screen.findByText('Анна')

  await openTab('Все')

  expect(await screen.findByText('Дина')).toBeInTheDocument()
  expect(screen.getByText('Анна')).toBeInTheDocument()
})

it('shows incoming and outgoing requests in «Ожидание» with the incoming badge', async () => {
  stubApi()
  renderPane()
  await screen.findByText('Анна')

  const tab = screen.getByRole('tab', { name: /Ожидание/ })
  expect(tab).toHaveAccessibleName('Ожидание, 1 входящая заявка')
  await openTab(/Ожидание/)

  expect(await screen.findByText('@eva')).toBeInTheDocument()
  expect(screen.getByText('@fedor')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Принять заявку от eva' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Отклонить заявку от eva' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Отменить заявку для fedor' })).toBeInTheDocument()
})

it('lists blocked accounts with a way back in «Заблокированные»', async () => {
  stubApi()
  renderPane()
  await screen.findByText('Анна')

  await openTab('Заблокированные')

  expect(await screen.findByText('@grigoriy')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Разблокировать' })).toBeInTheDocument()
})

it('accepts an incoming request', async () => {
  const calls = stubApi()
  renderPane()
  await screen.findByText('Анна')
  await openTab(/Ожидание/)

  await userEvent.click(await screen.findByRole('button', { name: 'Принять заявку от eva' }))

  await waitFor(() => {
    expect(
      calls.some(
        (call) => call.method === 'POST' && call.path === '/api/v1/friends/requests/u-eva/accept',
      ),
    ).toBe(true)
  })
})

it('declines an incoming request', async () => {
  const calls = stubApi()
  renderPane()
  await screen.findByText('Анна')
  await openTab(/Ожидание/)

  await userEvent.click(await screen.findByRole('button', { name: 'Отклонить заявку от eva' }))

  await waitFor(() => {
    expect(
      calls.some(
        (call) => call.method === 'DELETE' && call.path === '/api/v1/friends/requests/u-eva',
      ),
    ).toBe(true)
  })
})

it('cancels an outgoing request', async () => {
  const calls = stubApi()
  renderPane()
  await screen.findByText('Анна')
  await openTab(/Ожидание/)

  await userEvent.click(await screen.findByRole('button', { name: 'Отменить заявку для fedor' }))

  await waitFor(() => {
    expect(
      calls.some(
        (call) => call.method === 'DELETE' && call.path === '/api/v1/friends/requests/u-fedor',
      ),
    ).toBe(true)
  })
})

it('removes a friend from the menu', async () => {
  const calls = stubApi()
  renderPane()
  await screen.findByText('Анна')

  await userEvent.click(screen.getByRole('button', { name: 'Ещё: Анна' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Удалить из друзей' }))

  await waitFor(() => {
    expect(
      calls.some((call) => call.method === 'DELETE' && call.path === '/api/v1/friends/u-anna'),
    ).toBe(true)
  })
})

it('blocks a friend from the menu', async () => {
  const calls = stubApi()
  renderPane()
  await screen.findByText('Анна')

  await userEvent.click(screen.getByRole('button', { name: 'Ещё: Анна' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Заблокировать' }))

  await waitFor(() => {
    expect(
      calls.some((call) => call.method === 'PUT' && call.path === '/api/v1/users/me/blocks/u-anna'),
    ).toBe(true)
  })
})

it('unblocks an account', async () => {
  const calls = stubApi()
  renderPane()
  await screen.findByText('Анна')
  await openTab('Заблокированные')

  await userEvent.click(await screen.findByRole('button', { name: 'Разблокировать' }))

  await waitFor(() => {
    expect(
      calls.some(
        (call) => call.method === 'DELETE' && call.path === '/api/v1/users/me/blocks/u-grigoriy',
      ),
    ).toBe(true)
  })
})

it('opens the pair dialogue with «Написать»', async () => {
  const calls = stubApi()
  renderPane()
  await screen.findByText('Анна')

  await userEvent.click(screen.getByRole('button', { name: 'Написать Анна' }))

  expect(await screen.findByText('Открыт диалог')).toBeInTheDocument()
  const call = calls.find((item) => item.method === 'POST' && item.path === '/api/v1/conversations')
  expect(call?.body).toContain('u-anna')
})

it('sends a request by nickname and shows only the neutral answer', async () => {
  const calls = stubApi()
  renderPane()
  await screen.findByText('Анна')

  await userEvent.click(screen.getByRole('button', { name: 'Добавить в друзья' }))
  expect(screen.getByText('Ник чувствителен к написанию? Нет')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Ник'), '@eva')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить заявку' }))

  expect(
    await screen.findByText('Если такой пользователь есть, он получит заявку'),
  ).toBeInTheDocument()
  const call = calls.find(
    (item) => item.method === 'POST' && item.path === '/api/v1/friends/requests',
  )
  expect(call?.body).toContain('"nickname":"eva"')
})

it('reports a refused action instead of leaving it looking done', async () => {
  stubApi({
    failure: {
      method: 'POST',
      path: '/api/v1/friends/requests/u-eva/accept',
      status: 500,
      message: 'Сервер отказал',
    },
  })
  renderPane()
  await screen.findByText('Анна')
  await openTab(/Ожидание/)

  await userEvent.click(await screen.findByRole('button', { name: 'Принять заявку от eva' }))

  expect(await screen.findByText('Сервер отказал')).toBeInTheDocument()
})

it('says when a tab has nothing to show', async () => {
  stubApi({ friends: [], incoming: [], outgoing: [], blocks: [] })
  renderPane()

  expect(await screen.findByText('Сейчас никого нет в сети')).toBeInTheDocument()

  await openTab('Все')
  expect(await screen.findByText('Пока нет друзей')).toBeInTheDocument()

  await openTab(/Ожидание/)
  expect(await screen.findByText('Нет ожидающих заявок')).toBeInTheDocument()

  await openTab('Заблокированные')
  expect(await screen.findByText('Никого не заблокировали')).toBeInTheDocument()
})

it('searches the list by name and nickname', async () => {
  stubApi()
  renderPane()
  await screen.findByText('Анна')
  await openTab('Все')
  await screen.findByText('Дина')

  const search = screen.getByRole('searchbox', { name: 'Поиск по друзьям' })
  await userEvent.type(search, 'Дина')

  expect(await screen.findByText('Дина')).toBeInTheDocument()
  expect(screen.queryByText('Анна')).not.toBeInTheDocument()

  await userEvent.clear(search)
  await userEvent.type(search, 'никого')
  expect(await screen.findByText('Никого не нашли')).toBeInTheDocument()
})
