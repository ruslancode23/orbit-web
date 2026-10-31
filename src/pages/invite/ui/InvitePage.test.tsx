import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'

import { createFakePlatform, renderWithProviders } from '@/shared/lib/test'
import { setPlatform } from '@/shared/platform'

import InvitePage from './InvitePage'

const code = 'invite-code'
const workspaceId = '11111111-1111-4111-8111-111111111111'

const owner = {
  id: 'u-owner',
  nickname: 'Anna',
  isGuest: false,
  createdAt: '2026-10-20T10:00:00Z',
}
const guest = {
  id: 'u-guest',
  nickname: 'Гость',
  isGuest: true,
  createdAt: '2026-10-20T10:00:00Z',
}
const preview = {
  workspaceId,
  workspaceName: 'Команда',
  memberCount: 3,
}
const membership = {
  workspace: {
    id: workspaceId,
    name: 'Команда',
    description: null,
    iconUrl: null,
    memberPermissions: { canInvite: false, canCreateChannels: false, canAttachFiles: true },
    ownerId: owner.id,
    createdAt: '2026-10-20T10:00:00Z',
  },
  role: 'member',
}

interface StubOptions {
  /** Who the session belongs to; null means nobody is signed in. */
  me?: typeof owner | null
  dead?: boolean
}

const stubApi = ({ me = null, dead = false }: StubOptions = {}) => {
  const calls: { path: string; method: string; body: string }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      calls.push({
        path: url.pathname,
        method: request.method,
        body: request.method === 'GET' ? '' : await request.clone().text(),
      })

      if (url.pathname.endsWith('/auth/me')) {
        return me ? json(me) : error(401, 'unauthorized', 'no session')
      }
      if (url.pathname.endsWith(`/invites/${code}/preview`)) {
        return dead ? error(404, 'not_found', 'no invite') : json(preview)
      }
      if (url.pathname.endsWith(`/invites/${code}/accept`)) {
        return json(membership)
      }
      if (url.pathname.endsWith(`/invites/${code}/guest`)) {
        return json({ user: guest, membership })
      }
      return json({})
    }),
  )
  return calls
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const error = (status: number, codeName: string, message: string) =>
  json({ error: { code: codeName, message } }, status)

const renderPage = () =>
  renderWithProviders(
    <MemoryRouter initialEntries={[`/invite/${code}`]}>
      <Routes>
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/s/:workspaceId" element={<p>сервер</p>} />
        <Route path="/login" element={<p>вход</p>} />
        <Route path="/" element={<p>главная</p>} />
      </Routes>
    </MemoryRouter>,
  )

afterEach(() => {
  vi.unstubAllGlobals()
  setPlatform(null)
})

it('offers the desktop app to a browser', async () => {
  stubApi()
  renderPage()

  expect(await screen.findByRole('button', { name: 'Открыть в приложении' })).toBeInTheDocument()
})

it('does not offer the app from inside the app', async () => {
  stubApi()
  setPlatform({
    ...createFakePlatform(),
    links: { isDesktop: () => true, onOpen: () => () => undefined },
  })
  renderPage()

  await screen.findByRole('heading', { name: 'Команда' })
  expect(screen.queryByRole('button', { name: 'Открыть в приложении' })).not.toBeInTheDocument()
})

it('shows what the link leads to and a guest entrance to a newcomer', async () => {
  stubApi()
  renderPage()

  expect(await screen.findByRole('heading', { name: 'Команда' })).toBeInTheDocument()
  expect(screen.getByText('3 участника')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Войти как гость' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute(
    'href',
    `/login?next=${encodeURIComponent(`/invite/${code}`)}`,
  )
})

it('says a dead link is dead', async () => {
  stubApi({ dead: true })
  renderPage()

  expect(
    await screen.findByRole('heading', { name: 'Приглашение недействительно' }),
  ).toBeInTheDocument()
})

it('joins a signed-in account with one button', async () => {
  const calls = stubApi({ me: owner })
  renderPage()

  await userEvent.click(await screen.findByRole('button', { name: 'Вступить на сервер' }))

  expect(await screen.findByText('сервер')).toBeInTheDocument()
  expect(calls.some((call) => call.path.endsWith('/accept') && call.method === 'POST')).toBe(true)
})

it('lets a newcomer in by name alone', async () => {
  const calls = stubApi()
  renderPage()

  await userEvent.type(await screen.findByLabelText('Ваше имя'), 'Гость')
  await userEvent.click(screen.getByRole('button', { name: 'Войти как гость' }))

  expect(await screen.findByText('сервер')).toBeInTheDocument()
  const joined = calls.find((call) => call.path.endsWith('/guest'))
  expect(joined?.body).toContain('"nickname":"Гость"')
})

it('tells a guest when the name is taken', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      if (url.pathname.endsWith('/auth/me')) {
        return error(401, 'unauthorized', 'no session')
      }
      if (url.pathname.endsWith('/preview')) {
        return json(preview)
      }
      if (url.pathname.endsWith('/guest')) {
        return error(409, 'conflict', 'nickname taken')
      }
      return json({})
    }),
  )
  renderPage()

  await userEvent.type(await screen.findByLabelText('Ваше имя'), 'Гость')
  await userEvent.click(screen.getByRole('button', { name: 'Войти как гость' }))

  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent('Это имя уже занято')
  })
})
