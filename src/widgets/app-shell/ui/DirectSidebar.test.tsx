import { screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

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
  secretChats?: unknown[]
  conversationsAnswer?: () => Promise<Response>
}

/** Answers the session, the conversations and the secret chats of the device. */
const stubApi = ({
  conversations = [direct, group],
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

const renderSidebar = (route = '/dm') =>
  renderWithProviders(
    <MemoryRouter initialEntries={[route]}>
      <DirectSidebar />
    </MemoryRouter>,
  )

afterEach(() => {
  setPlatform(null)
  vi.unstubAllGlobals()
})

it('shows the personal messages in the server order and marks the open one', async () => {
  stubApi()
  renderSidebar('/dm/c-group')

  expect(screen.getByRole('heading', { name: 'Личные сообщения', level: 2 })).toBeInTheDocument()

  const directLink = await screen.findByRole('link', { name: 'Боб' })
  const groupLink = screen.getByRole('link', { name: 'Боб, Кэрол' })
  expect(directLink).toHaveAttribute('href', '/dm/c-direct')
  expect(groupLink).toHaveAttribute('href', '/dm/c-group')
  expect(groupLink).toHaveAttribute('aria-current', 'page')
  expect(directLink).not.toHaveAttribute('aria-current')

  const links = within(screen.getByRole('region', { name: 'Диалоги' })).getAllByRole('link')
  expect(links.map((link) => link.getAttribute('href'))).toEqual(['/dm/c-direct', '/dm/c-group'])
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
  expect(link).toHaveAttribute('href', '/dm/s/s-1')
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
