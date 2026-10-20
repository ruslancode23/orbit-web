import { screen } from '@testing-library/react'
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
  detail?: unknown
  detailStatus?: number
}

/**
 * The page uses the chat widget, and the widget asks for the history of the
 * channel id. A conversation id is a channel id, so the same stub answers both;
 * the empty workspace path is what `workspaceId=""` produces until the server
 * grows unread support for conversations.
 */
const stubApi = ({ detail = direct, detailStatus = 200 }: StubOptions = {}) => {
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

const renderPage = (route = '/dm') =>
  renderWithProviders(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/dm" element={<DirectPage />} />
        <Route path="/dm/:conversationId" element={<DirectPage />} />
      </Routes>
    </MemoryRouter>,
  )

afterEach(() => {
  vi.unstubAllGlobals()
})

it('asks to pick a dialogue when none is open', () => {
  renderPage('/dm')

  expect(screen.getByRole('heading', { name: 'Выберите диалог' })).toBeInTheDocument()
  expect(screen.getByText(/Слева — личные сообщения и секретные чаты/)).toBeInTheDocument()
})

it('opens a pair dialogue with the peer and the usual composer', async () => {
  stubApi()
  renderPage('/dm/c-direct')

  expect(await screen.findByRole('heading', { name: 'Боб', level: 1 })).toBeInTheDocument()
  expect(screen.queryByText('Групповой чат')).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Чат' })).toBeInTheDocument()
  const composer = screen.getByLabelText('Сообщение')
  expect(composer).toHaveAttribute('placeholder', 'Написать в #Боб')
  expect(screen.getByRole('button', { name: 'Прикрепить файл' })).toBeInTheDocument()
})

it('names the members of a group and marks it as one', async () => {
  stubApi({ detail: group })
  renderPage('/dm/c-group')

  expect(await screen.findByRole('heading', { name: 'Боб, Кэрол', level: 1 })).toBeInTheDocument()
  expect(screen.getByText('Групповой чат')).toBeInTheDocument()
  expect(screen.getByLabelText('Сообщение')).toHaveAttribute(
    'placeholder',
    'Написать в #Боб, Кэрол',
  )
})

it('says a missing dialogue is missing and leads back', async () => {
  stubApi({ detailStatus: 404 })
  renderPage('/dm/c-direct')

  expect(await screen.findByRole('heading', { name: 'Диалог не найден' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'К личным сообщениям' })).toHaveAttribute('href', '/dm')
})
