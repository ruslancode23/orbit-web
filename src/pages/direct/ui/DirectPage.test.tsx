import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'

import { renderWithProviders } from '@/shared/lib/test'

import DirectPage from './DirectPage'

const anna = { id: 'u-anna', nickname: 'Анна', isGuest: false, createdAt: '2026-10-20T10:00:00Z' }
const bob = { id: 'u-bob', nickname: 'Боб', isGuest: false, createdAt: '2026-10-20T10:00:00Z' }
const carol = {
  id: 'u-carol',
  nickname: 'Кэрол',
  isGuest: false,
  createdAt: '2026-10-20T10:00:00Z',
}

const direct = {
  id: 'c-direct',
  kind: 'direct',
  members: [anna, bob],
  createdAt: '2026-10-20T10:00:00Z',
}
const group = {
  id: 'c-group',
  kind: 'group',
  members: [anna, bob, carol],
  createdAt: '2026-10-20T11:00:00Z',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

interface StubOptions {
  conversations?: unknown[]
  detail?: unknown
  detailStatus?: number
}

/**
 * The page uses the chat widget, which asks for the history of the channel id.
 * A conversation id is a channel id, so the same stub answers both.
 */
const stubApi = ({
  conversations = [direct, group],
  detail = direct,
  detailStatus = 200,
}: StubOptions = {}) => {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      calls.push(`${request.method} ${url.pathname}`)
      if (url.pathname.endsWith('/auth/me')) {
        return json(anna)
      }
      if (url.pathname === '/api/v1/friends') {
        return json([])
      }
      if (url.pathname === '/api/v1/friends/requests') {
        return json([])
      }
      if (url.pathname === '/api/v1/users/me/blocks') {
        return json([])
      }
      if (url.pathname === '/api/v1/conversations') {
        return json(conversations)
      }
      if (url.pathname === '/api/v1/conversations/c-direct') {
        return detailStatus === 200
          ? json(direct)
          : json({ error: { code: 'not_found', message: 'no conversation' } }, detailStatus)
      }
      if (url.pathname === '/api/v1/conversations/c-group') {
        return json(group)
      }
      if (url.pathname.startsWith('/api/v1/conversations/')) {
        return detailStatus === 200
          ? json(detail)
          : json({ error: { code: 'not_found', message: 'no conversation' } }, detailStatus)
      }
      if (url.pathname === '/api/v1/workspaces') {
        return json([])
      }
      if (url.pathname.endsWith('/unread')) {
        return json([])
      }
      if (url.pathname.endsWith('/members')) {
        return json([])
      }
      if (url.pathname.endsWith('/messages')) {
        return json({ messages: [] })
      }
      return json({})
    }),
  )
  return calls
}

const renderPage = (route = '/me') =>
  renderWithProviders(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/me" element={<DirectPage />} />
        <Route path="/me/friends" element={<DirectPage />} />
        <Route path="/me/:conversationId" element={<DirectPage />} />
      </Routes>
    </MemoryRouter>,
  )

afterEach(() => {
  vi.unstubAllGlobals()
})

it('opens the friends section by default at /me', async () => {
  stubApi()
  renderPage('/me')

  expect(await screen.findByRole('heading', { name: 'Друзья', level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Добавить в друзья' })).toBeInTheDocument()
})

it('opens the friends section at the explicit /me/friends route', async () => {
  stubApi()
  renderPage('/me/friends')

  expect(await screen.findByRole('heading', { name: 'Друзья', level: 1 })).toBeInTheDocument()
  // The static segment is not read as a dialogue id.
  expect(screen.queryByRole('region', { name: 'Чат' })).not.toBeInTheDocument()
})

it('opens a pair dialogue with the peer and the usual composer', async () => {
  stubApi()
  renderPage('/me/c-direct')

  expect(await screen.findByRole('heading', { name: 'Боб', level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Чат' })).toBeInTheDocument()
  const composer = screen.getByLabelText('Сообщение')
  expect(composer).toHaveAttribute('placeholder', 'Написать в #Боб')
  expect(screen.getByRole('button', { name: 'Прикрепить файл' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Добавить людей' })).not.toBeInTheDocument()
})

it('names the members of a group and offers adding people', async () => {
  stubApi({ detail: group })
  renderPage('/me/c-group')

  expect(await screen.findByRole('heading', { name: 'Боб, Кэрол', level: 1 })).toBeInTheDocument()
  expect(screen.getByText('3 участника: Боб, Кэрол')).toBeInTheDocument()
  const add = screen.getByRole('button', { name: 'Добавить людей' })
  expect(add).toBeDisabled()
  expect(screen.getByLabelText('Сообщение')).toHaveAttribute(
    'placeholder',
    'Написать в #Боб, Кэрол',
  )
})

it('suggests the group members after @', async () => {
  stubApi({ detail: group })
  renderPage('/me/c-group')

  await screen.findByRole('heading', { name: 'Боб, Кэрол', level: 1 })
  await userEvent.type(screen.getByLabelText('Сообщение'), '@')

  const hints = await screen.findByRole('listbox', { name: 'Подсказки упоминаний' })
  expect(within(hints).getByRole('option', { name: 'Боб' })).toBeInTheDocument()
  expect(within(hints).getByRole('option', { name: 'Кэрол' })).toBeInTheDocument()
  expect(within(hints).queryByRole('option', { name: 'Анна' })).not.toBeInTheDocument()
})

it('says a missing dialogue is missing and leads back', async () => {
  stubApi({ detailStatus: 404 })
  renderPage('/me/c-direct')

  expect(await screen.findByRole('heading', { name: 'Диалог не найден' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'К личным сообщениям' })).toHaveAttribute('href', '/me')
})

it('offers a secret chat in the menu of a pair dialogue', async () => {
  stubApi()
  renderPage('/me/c-direct')

  await screen.findByRole('heading', { name: 'Боб', level: 1 })
  await userEvent.click(screen.getByRole('button', { name: 'Действия с диалогом' }))

  expect(await screen.findByRole('menuitem', { name: 'Секретный чат' })).toBeInTheDocument()
})

it('has no secret chat for a group', async () => {
  stubApi({ detail: group })
  renderPage('/me/c-group')

  await screen.findByRole('heading', { name: 'Боб, Кэрол', level: 1 })
  expect(screen.queryByRole('button', { name: 'Действия с диалогом' })).not.toBeInTheDocument()
})
