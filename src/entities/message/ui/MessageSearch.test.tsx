import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/shared/lib/test'

import { MessageSearch } from './MessageSearch'

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const hit = {
  message: {
    id: 'm-1',
    channelId: 'c-1',
    seq: 7,
    kind: 'user',
    content: 'привет, поиск',
    mentions: [],
    reactions: [],
    attachments: [],
    createdAt: '2026-10-24T10:00:00Z',
    author: {
      id: 'u-bob',
      nickname: 'bob',
      displayName: 'Боб',
      accentColor: 'slate',
      bio: '',
      isGuest: false,
      createdAt: '2026-10-18T10:00:00Z',
    },
  },
  headline: 'привет, \u0002поиск\u0003',
  channelName: null,
  workspaceId: null,
  nextCursor: null,
}

const stubSearch = (page: unknown) => {
  const fetch = vi.fn((input: unknown) => {
    const request = input as Request
    const url = new URL(request.url)
    if (url.pathname === '/api/v1/search/messages') {
      return Promise.resolve(json(page))
    }
    return Promise.resolve(json({}))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('searches after a pause and marks the matched words', async () => {
  stubSearch({ items: [hit], nextCursor: null })
  renderWithProviders(<MessageSearch conversationId="c-1" />, { route: '/me/c-1' })

  await userEvent.click(screen.getByRole('button', { name: 'Поиск по сообщениям' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Поиск по сообщениям' }), 'поиск')

  const results = await screen.findByRole('list', { name: 'Результаты поиска' })
  expect((await within(results).findByText('поиск')).tagName).toBe('MARK')
  expect(await within(results).findByText('Личное сообщение')).toBeInTheDocument()
})

it('says when nothing was found', async () => {
  stubSearch({ items: [], nextCursor: null })
  renderWithProviders(<MessageSearch conversationId="c-1" />, { route: '/me/c-1' })

  await userEvent.click(screen.getByRole('button', { name: 'Поиск по сообщениям' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Поиск по сообщениям' }), 'тишина')

  expect(await screen.findByText('Ничего не найдено.')).toBeInTheDocument()
})

it('does not search an empty field', async () => {
  const fetch = stubSearch({ items: [], nextCursor: null })
  renderWithProviders(<MessageSearch conversationId="c-1" />, { route: '/me/c-1' })

  await userEvent.click(screen.getByRole('button', { name: 'Поиск по сообщениям' }))
  await waitFor(() => {
    expect(screen.getByText('Введите слово или фразу.')).toBeInTheDocument()
  })
  expect(fetch).not.toHaveBeenCalled()
})
