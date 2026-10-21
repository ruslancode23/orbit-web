import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

import { formatRelativeTime } from '@/entities/message'
import type { ConversationLastMessage, ConversationSummary } from '@/shared/api'
import { createFakePlatform, renderWithProviders } from '@/shared/lib/test'
import { setPlatform } from '@/shared/platform'

import { DirectSidebar } from './DirectSidebar'

const anna = {
  id: 'u-anna',
  nickname: 'Анна',
  displayName: 'Анна',
  accentColor: 'slate' as const,
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-10-20T10:00:00Z'),
  joinedAt: new Date('2026-10-20T10:00:00Z'),
}
const bob = {
  id: 'u-bob',
  nickname: 'Боб',
  displayName: 'Боб',
  accentColor: 'slate' as const,
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-10-20T10:00:00Z'),
  joinedAt: new Date('2026-10-20T10:00:00Z'),
}
const carol = {
  id: 'u-carol',
  nickname: 'Кэрол',
  displayName: 'Кэрол',
  accentColor: 'slate' as const,
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-10-20T10:00:00Z'),
  joinedAt: new Date('2026-10-20T10:00:00Z'),
}

const lastMessage = (
  id: string,
  content: string,
  createdAt: string,
  author = bob,
): ConversationLastMessage => ({
  id,
  seq: 1n,
  kind: 'user',
  author,
  content,
  createdAt: new Date(createdAt),
})

const directRow: ConversationSummary = {
  id: 'c-direct',
  kind: 'direct',
  members: [anna, bob],
  createdAt: new Date('2026-10-20T10:00:00Z'),
  lastMessage: lastMessage('m-direct', 'привет', '2026-10-20T12:00:00Z'),
  lastReadSeq: 0n,
  unread: 0,
  mentions: 0,
}
const groupRow: ConversationSummary = {
  id: 'c-group',
  kind: 'group',
  name: 'Команда',
  members: [anna, bob, carol],
  createdAt: new Date('2026-10-20T11:00:00Z'),
  lastMessage: lastMessage('m-group', 'как дела', '2026-10-20T11:30:00Z'),
  lastReadSeq: 0n,
  unread: 0,
  mentions: 0,
}
const secret = {
  id: 's-1',
  createdAt: '2026-10-20T12:00:00Z',
  peer: {
    userId: bob.id,
    nickname: 'Боб',
    isGuest: false,
    deviceId: 'd-bob',
    identityKey: 'identity',
    signingKey: 'signing',
  },
}

const json = (body: unknown, status = 200) =>
  new Response(
    JSON.stringify(body, (_key, value: unknown) =>
      typeof value === 'bigint' ? Number(value) : value,
    ),
    { status, headers: { 'Content-Type': 'application/json' } },
  )

const createDeferred = <T,>() => {
  let settle: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })
  return { promise, resolve: settle }
}

interface StubOptions {
  pages?: Record<string, { conversations: ConversationSummary[]; nextCursor?: string }>
  secretChats?: unknown[]
  friends?: unknown[]
  conversationsAnswer?: () => Promise<Response>
}

interface StubState {
  calls: string[]
  hiddenPosts: string[]
  hiddenDeletes: string[]
}

/** Answers the session, the paged dialogues, their unread badge and the secret chats. */
const stubApi = ({
  pages = { '': { conversations: [groupRow, directRow] } },
  secretChats = [],
  friends = [],
  conversationsAnswer,
}: StubOptions = {}): StubState => {
  const state: StubState = { calls: [], hiddenPosts: [], hiddenDeletes: [] }
  const hidden = new Set<string>()
  const totals = () => {
    let unread = 0
    let mentions = 0
    for (const page of Object.values(pages)) {
      for (const conversation of page.conversations) {
        if (hidden.has(conversation.id)) {
          continue
        }
        unread += conversation.unread
        mentions += conversation.mentions
      }
    }
    return { unread, mentions }
  }

  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      state.calls.push(`${request.method} ${url.pathname}${url.search}`)
      if (url.pathname.endsWith('/auth/me')) {
        return json(anna)
      }
      if (url.pathname === '/api/v1/friends') {
        return json(friends)
      }
      if (url.pathname === '/api/v1/secret-chats') {
        return json(secretChats)
      }
      if (url.pathname === '/api/v1/conversations/unread') {
        return json(totals())
      }
      if (url.pathname === '/api/v1/conversations' && request.method === 'GET') {
        if (conversationsAnswer) {
          return conversationsAnswer()
        }
        const cursor = url.searchParams.get('cursor') ?? ''
        const page = pages[cursor] ?? { conversations: [] }
        return json({
          ...page,
          conversations: page.conversations.filter((conversation) => !hidden.has(conversation.id)),
        })
      }
      const hiddenPath = /^\/api\/v1\/conversations\/([^/]+)\/hidden$/u.exec(url.pathname)
      if (hiddenPath?.[1] !== undefined) {
        if (request.method === 'POST') {
          hidden.add(hiddenPath[1])
          state.hiddenPosts.push(hiddenPath[1])
          return new Response(null, { status: 204 })
        }
        hidden.delete(hiddenPath[1])
        state.hiddenDeletes.push(hiddenPath[1])
        return new Response(null, { status: 204 })
      }
      return json({})
    }),
  )
  return state
}

const giveSecretDevice = async () => {
  const platform = createFakePlatform()
  setPlatform(platform)
  await platform.secretStore.set('secret', 'device', {
    deviceId: 'd-anna',
    userId: anna.id,
    name: 'Браузер Анны',
    identityKey: 'identity',
    signingKey: 'signing',
  })
  return platform
}

const renderSidebar = (route = '/me') =>
  renderWithProviders(
    <MemoryRouter initialEntries={[route]}>
      <DirectSidebar />
    </MemoryRouter>,
  )

afterEach(() => {
  setPlatform(null)
  vi.unstubAllGlobals()
})

it('orders the dialogues as the server sent them and marks the open one', async () => {
  stubApi()
  renderSidebar('/me/c-group')

  const directLink = await screen.findByRole('link', { name: 'Боб' })
  const groupLink = screen.getByRole('link', { name: 'Команда' })
  expect(directLink).toHaveAttribute('href', '/me/c-direct')
  expect(groupLink).toHaveAttribute('href', '/me/c-group')
  expect(groupLink).toHaveAttribute('aria-current', 'page')
  expect(directLink).not.toHaveAttribute('aria-current')

  const links = within(screen.getByRole('region', { name: 'Диалоги' })).getAllByRole('link')
  expect(links.map((link) => link.getAttribute('href'))).toEqual(['/me/c-group', '/me/c-direct'])
})

it('shows the preview and its time from the list row', async () => {
  stubApi()
  renderSidebar()

  const directLink = await screen.findByRole('link', { name: 'Боб' })
  expect(within(directLink).getByText('привет')).toBeInTheDocument()
  expect(
    within(directLink).getByText(formatRelativeTime(new Date('2026-10-20T12:00:00Z'))),
  ).toBeInTheDocument()

  const groupLink = screen.getByRole('link', { name: 'Команда' })
  expect(within(groupLink).getByText('Боб: как дела')).toBeInTheDocument()
})

it('takes the group title from the list instead of joining the members', async () => {
  stubApi()
  renderSidebar()

  expect(await screen.findByRole('link', { name: 'Команда' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Боб, Кэрол' })).not.toBeInTheDocument()
})

it('shows the unread and mention counts the server returned after a reload', async () => {
  stubApi({
    pages: {
      '': {
        conversations: [{ ...directRow, unread: 3, mentions: 1 }, groupRow],
      },
    },
  })
  renderSidebar()

  const directLink = await screen.findByRole('link', {
    name: 'Боб, 3 непрочитанных, 1 упоминание',
  })
  expect(within(directLink).getByText('3')).toBeInTheDocument()
  expect(within(directLink).getByText('@1')).toBeInTheDocument()
})

it('does not ask for the history of a dialogue to draw the list', async () => {
  const state = stubApi()
  renderSidebar()

  await screen.findByRole('link', { name: 'Боб' })
  expect(state.calls.some((call) => call.includes('/messages'))).toBe(false)
})

it('filters the dialogues by name and says when nobody matches', async () => {
  stubApi()
  renderSidebar()
  await screen.findByRole('link', { name: 'Боб' })

  const search = screen.getByRole('searchbox', { name: 'Поиск по личным сообщениям' })
  await userEvent.type(search, 'Кэрол')

  expect(screen.getByRole('link', { name: 'Команда' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Боб' })).not.toBeInTheDocument()

  await userEvent.clear(search)
  await userEvent.type(search, 'даша')
  expect(screen.getByText('Никого не нашли')).toBeInTheDocument()
})

it('loads the next page by the server cursor and keeps focus in the list', async () => {
  const many = Array.from({ length: 20 }, (_, index) => ({
    ...directRow,
    id: `c-${String(index)}`,
    members: [
      anna,
      { ...bob, nickname: `Боб ${String(index)}`, displayName: `Боб ${String(index)}` },
    ],
  }))
  const next = {
    ...directRow,
    id: 'c-last',
    members: [anna, { ...bob, nickname: 'Боб последний', displayName: 'Боб последний' }],
  }
  const state = stubApi({
    pages: {
      '': { conversations: many, nextCursor: 'page-2' },
      'page-2': { conversations: [next] },
    },
  })
  renderSidebar()

  await screen.findByRole('link', { name: 'Боб 0' })
  expect(within(screen.getByRole('region', { name: 'Диалоги' })).getAllByRole('link')).toHaveLength(
    20,
  )

  await userEvent.click(screen.getByRole('button', { name: 'Показать ещё' }))

  const last = await screen.findByRole('link', { name: 'Боб последний' })
  expect(state.calls.some((call) => call.includes('cursor=page-2'))).toBe(true)
  await waitFor(() => {
    expect(last).toHaveFocus()
  })
})

it('hides a dialogue and can bring it back from the toast', async () => {
  const state = stubApi({
    pages: {
      '': {
        conversations: [{ ...directRow, unread: 1, mentions: 0 }, groupRow],
      },
    },
  })
  renderSidebar()

  await screen.findByRole('link', { name: 'Боб, 1 непрочитанное' })
  const [trigger] = screen.getAllByRole('button', { name: 'Действия с беседой' })
  if (!trigger) {
    throw new Error('the row has no actions button')
  }
  await userEvent.click(trigger)
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Скрыть' }))

  await waitFor(() => {
    expect(screen.queryByRole('link', { name: /Боб/ })).not.toBeInTheDocument()
  })
  expect(state.hiddenPosts).toEqual(['c-direct'])

  await userEvent.click(await screen.findByRole('button', { name: 'Вернуть' }))

  await waitFor(() => {
    expect(state.hiddenDeletes).toEqual(['c-direct'])
  })
  expect(await screen.findByRole('link', { name: /Боб/ })).toBeInTheDocument()
})

it('hides the secret section when this browser has no secret device', async () => {
  setPlatform(createFakePlatform())
  const state = stubApi()
  renderSidebar()

  await screen.findByRole('link', { name: 'Боб' })
  await waitFor(() => {
    expect(state.calls.some((call) => call.startsWith('GET /api/v1/conversations'))).toBe(true)
  })
  expect(screen.queryByRole('heading', { name: 'Секретные чаты' })).not.toBeInTheDocument()
  expect(state.calls.some((call) => call.includes('/secret-chats'))).toBe(false)
})

it('shows the secret chats of the device with their own links', async () => {
  await giveSecretDevice()
  const state = stubApi({ secretChats: [secret] })
  renderSidebar()

  const section = await screen.findByRole('list', { name: 'Секретные чаты с Боб' })
  const link = await within(section).findByRole('link', { name: 'Секретный чат' })
  expect(link).toHaveAttribute('href', '/me/s/s-1')
  expect(link).toHaveClass('text-success')
  expect(state.calls.some((call) => call.includes('/secret-chats'))).toBe(true)
})

it('says when there is nothing yet', async () => {
  await giveSecretDevice()
  stubApi({ pages: { '': { conversations: [] } } })
  renderSidebar()

  expect(await screen.findByText('Пока нет личных сообщений')).toBeInTheDocument()
  // Empty secret chats are not a section of their own: they live under dialogues.
  expect(screen.queryByRole('heading', { name: 'Секретные чаты' })).not.toBeInTheDocument()
})

it('shows a skeleton while the dialogues are loading', async () => {
  const answer = createDeferred<Response>()
  stubApi({ conversationsAnswer: () => answer.promise })
  renderSidebar()

  expect(screen.getByRole('status', { name: 'Загружаем диалоги' })).toBeInTheDocument()

  answer.resolve(json({ conversations: [directRow] }))
  expect(await screen.findByRole('link', { name: 'Боб' })).toBeInTheDocument()
})

it('puts «Друзья» above the dialogues and marks it current in the friends section', async () => {
  stubApi({ pages: { '': { conversations: [] } } })
  renderSidebar('/me')

  const friends = await screen.findByRole('link', { name: 'Друзья' })
  expect(friends).toHaveAttribute('href', '/me/friends')
  expect(friends).toHaveAttribute('aria-current', 'page')
})

it('does not mark «Друзья» current inside a dialogue', async () => {
  stubApi()
  renderSidebar('/me/c-direct')

  await screen.findByRole('link', { name: 'Боб' })
  expect(screen.getByRole('link', { name: 'Друзья' })).not.toHaveAttribute('aria-current')
})
