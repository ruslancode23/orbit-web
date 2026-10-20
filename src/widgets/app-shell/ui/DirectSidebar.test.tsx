import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

import { formatRelativeTime } from '@/entities/message'
import { resetConversationUnread, setConversationUnread } from '@/entities/unread'
import { createFakePlatform, renderWithProviders } from '@/shared/lib/test'
import { setPlatform } from '@/shared/platform'

import { DirectSidebar } from './DirectSidebar'

const anna = { id: 'u-anna', nickname: 'Анна', isGuest: false, createdAt: new Date() }
const bob = { id: 'u-bob', nickname: 'Боб', isGuest: false, createdAt: new Date() }
const carol = { id: 'u-carol', nickname: 'Кэрол', isGuest: false, createdAt: new Date() }

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

const message = (id: string, channelId: string, content: string, createdAt: string) => {
  return {
    id,
    channelId,
    seq: 1,
    content,
    createdAt,
    mentions: [],
    reactions: [],
    author: bob,
  }
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const createDeferred = <T,>() => {
  let settle: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })
  return { promise, resolve: settle }
}

interface StubOptions {
  conversations?: unknown[]
  messages?: Record<string, ReturnType<typeof message> | undefined>
  secretChats?: unknown[]
  conversationsAnswer?: () => Promise<Response>
}

/** Answers the session, the conversations, their latest message and the secret chats. */
const stubApi = ({
  conversations = [group, direct],
  messages = {
    'c-direct': message('m-direct', 'c-direct', 'привет', '2026-10-20T12:00:00Z'),
    'c-group': message('m-group', 'c-group', 'как дела', '2026-10-20T11:30:00Z'),
  },
  secretChats = [],
  conversationsAnswer,
}: StubOptions = {}) => {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      calls.push(url.pathname)
      if (url.pathname.endsWith('/auth/me')) {
        return json(anna)
      }
      if (url.pathname === '/api/v1/conversations') {
        return conversationsAnswer ? conversationsAnswer() : json(conversations)
      }
      if (url.pathname === '/api/v1/secret-chats') {
        return json(secretChats)
      }
      const channel = /^\/api\/v1\/channels\/([^/]+)\/messages$/u.exec(url.pathname)?.[1]
      if (channel !== undefined) {
        const latest = messages[channel]
        return json({ messages: latest ? [latest] : [] })
      }
      return json({})
    }),
  )
  return calls
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
  act(() => {
    resetConversationUnread()
  })
  setPlatform(null)
  vi.unstubAllGlobals()
})

it('orders the dialogues by their last message and marks the open one', async () => {
  stubApi()
  renderSidebar('/me/c-group')

  const directLink = await screen.findByRole('link', { name: 'Боб' })
  const groupLink = screen.getByRole('link', { name: 'Боб, Кэрол' })
  expect(directLink).toHaveAttribute('href', '/me/c-direct')
  expect(groupLink).toHaveAttribute('href', '/me/c-group')
  expect(groupLink).toHaveAttribute('aria-current', 'page')
  expect(directLink).not.toHaveAttribute('aria-current')

  // The newest message belongs to the pair, although the server listed the
  // group first: the list is ordered by last activity.
  await waitFor(() => {
    const links = within(screen.getByRole('region', { name: 'Диалоги' })).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/me/c-direct', '/me/c-group'])
  })
})

it('shows the last message, its time and a group author', async () => {
  stubApi()
  renderSidebar()

  const directLink = await screen.findByRole('link', { name: 'Боб' })
  await waitFor(() => {
    expect(within(directLink).getByText('привет')).toBeInTheDocument()
  })
  expect(
    within(directLink).getByText(formatRelativeTime(new Date('2026-10-20T12:00:00Z'))),
  ).toBeInTheDocument()

  const groupLink = screen.getByRole('link', { name: 'Боб, Кэрол' })
  await waitFor(() => {
    expect(within(groupLink).getByText('Боб: как дела')).toBeInTheDocument()
  })
})

it('raises the unread badge and says the count in the link name', async () => {
  setConversationUnread('c-direct', { unread: 3, mentions: 1 })
  stubApi()
  renderSidebar()

  const directLink = await screen.findByRole('link', {
    name: 'Боб, 3 непрочитанных, 1 упоминание',
  })
  expect(within(directLink).getByText('3')).toBeInTheDocument()
  expect(within(directLink).getByText('@1')).toBeInTheDocument()
})

it('filters the dialogues by name and says when nobody matches', async () => {
  stubApi()
  renderSidebar()
  await screen.findByRole('link', { name: 'Боб' })

  const search = screen.getByRole('searchbox', { name: 'Поиск по личным сообщениям' })
  await userEvent.type(search, 'Кэрол')

  expect(screen.getByRole('link', { name: 'Боб, Кэрол' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Боб' })).not.toBeInTheDocument()

  await userEvent.clear(search)
  await userEvent.type(search, 'даша')
  expect(screen.getByText('Никого не нашли')).toBeInTheDocument()
})

it('draws the list a page at a time', async () => {
  const many = Array.from({ length: 25 }, (_, index) => ({
    ...direct,
    id: `c-${String(index)}`,
    members: [anna, { ...bob, nickname: `Боб ${String(index)}` }],
  }))
  stubApi({ conversations: many, messages: {} })
  renderSidebar()

  await screen.findByRole('link', { name: 'Боб 0' })
  const list = screen.getByRole('region', { name: 'Диалоги' })
  expect(within(list).getAllByRole('link')).toHaveLength(20)

  await userEvent.click(screen.getByRole('button', { name: 'Показать ещё' }))
  expect(within(list).getAllByRole('link')).toHaveLength(25)
})

it('offers hiding only as a switched-off action without a server method', async () => {
  stubApi()
  renderSidebar()

  await screen.findByRole('link', { name: 'Боб' })
  const [trigger] = screen.getAllByRole('button', { name: 'Действия с беседой' })
  if (!trigger) {
    throw new Error('the row has no actions button')
  }
  await userEvent.click(trigger)

  const hide = await screen.findByRole('menuitem', { name: 'Скрыть' })
  expect(hide).toHaveAttribute('aria-disabled', 'true')
})

it('hides the secret section when this browser has no secret device', async () => {
  setPlatform(createFakePlatform())
  const calls = stubApi()
  renderSidebar()

  await screen.findByRole('link', { name: 'Боб' })
  await waitFor(() => {
    expect(calls).toContain('/api/v1/conversations')
  })
  expect(screen.queryByRole('heading', { name: 'Секретные чаты' })).not.toBeInTheDocument()
  expect(calls).not.toContain('/api/v1/secret-chats')
})

it('shows the secret chats of the device with their own links', async () => {
  await giveSecretDevice()
  const calls = stubApi({ secretChats: [secret] })
  renderSidebar()

  const section = await screen.findByRole('list', { name: 'Секретные чаты с Боб' })
  const link = await within(section).findByRole('link', { name: 'Секретный чат' })
  expect(link).toHaveAttribute('href', '/me/s/s-1')
  expect(link).toHaveClass('text-success')
  expect(calls).toContain('/api/v1/secret-chats')
})

it('says when there is nothing yet', async () => {
  await giveSecretDevice()
  stubApi({ conversations: [], secretChats: [] })
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

  answer.resolve(json([direct]))
  expect(await screen.findByRole('link', { name: 'Боб' })).toBeInTheDocument()
})

it('puts «Друзья» above the dialogues and marks it current in the friends section', async () => {
  stubApi({ conversations: [] })
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
