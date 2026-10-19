import { act, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

import { LiveProvider } from '@/entities/live'
import { createFakePlatform, renderWithProviders } from '@/shared/lib/test'
import { setPlatform } from '@/shared/platform'

import { AppShell } from './AppShell'

const workspaceId = '11111111-1111-4111-8111-111111111111'
const channelId = '22222222-2222-4222-8222-222222222222'
const otherChannelId = '33333333-3333-4333-8333-333333333333'

const anna = { id: 'u1', nickname: 'Anna', isGuest: false, createdAt: '2026-10-18T10:00:00Z' }

type Role = 'owner' | 'admin' | 'member'

const defaultPermissions = { canInvite: false, canCreateChannels: false, canAttachFiles: true }

const membership = (role: Role, memberPermissions = defaultPermissions) => {
  return {
    workspace: {
      id: workspaceId,
      name: 'Команда Orbit',
      description: null,
      iconUrl: null,
      memberPermissions,
      ownerId: 'u1',
      createdAt: '2026-10-18T10:00:00Z',
    },
    role,
  }
}

const channels = [
  {
    id: channelId,
    workspaceId,
    name: 'общий',
    position: 0,
    isReadOnly: false,
    canWrite: true,
    createdAt: '2026-10-18T10:00:00Z',
  },
  {
    id: otherChannelId,
    workspaceId,
    name: 'флуд',
    position: 1,
    isReadOnly: false,
    canWrite: true,
    createdAt: '2026-10-18T10:00:00Z',
  },
]

type Counts = { channelId: string; lastReadSeq: number; unread: number; mentions: number }[]

const noUnread: Counts = [
  { channelId, lastReadSeq: 0, unread: 0, mentions: 0 },
  { channelId: otherChannelId, lastReadSeq: 0, unread: 0, mentions: 0 },
]

/** Sockets the shell opened, so a test can play the server's part. */
const sockets: FakeSocket[] = []

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

  /** Delivers one frame from the server. */
  receive(frame: object) {
    for (const listener of this.listeners.get('message') ?? []) {
      listener(new MessageEvent('message', { data: JSON.stringify(frame) }))
    }
  }
}

/**
 * Answers whatever each endpoint of this test needs, by path. `unread` is
 * read on every request, so a test can change what the server would say.
 */
const stubApi = (
  role: Role,
  unread: { current: Counts } = { current: noUnread },
  memberPermissions = defaultPermissions,
) => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown) => {
      const url = input instanceof Request ? input.url : String(input)
      const body = url.includes('/auth/me')
        ? anna
        : url.includes('/unread')
          ? unread.current
          : url.includes('/channels')
            ? channels
            : url.includes('/workspaces')
              ? [membership(role, memberPermissions)]
              : {}
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }),
  )
  // A socket that never connects by itself; tests push frames through it.
  vi.stubGlobal('WebSocket', FakeSocket)
}

afterEach(() => {
  sockets.length = 0
  setPlatform(null)
  vi.unstubAllGlobals()
})

const renderShell = () => {
  return renderWithProviders(
    <LiveProvider enabled>
      <MemoryRouter initialEntries={[`/s/${workspaceId}/${channelId}`]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/s/:workspaceId/:channelId" element={<p>содержимое канала</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LiveProvider>,
  )
}

it('shows the servers, the channels and the open channel', async () => {
  stubApi('member')
  renderShell()

  expect(await screen.findByRole('link', { name: '# общий' })).toBeInTheDocument()
  expect(screen.getByText('Команда Orbit')).toBeInTheDocument()
  expect(screen.getByText('содержимое канала')).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Серверы' })).toBeInTheDocument()
})

it('marks the open server in the rail and names it in a hint', async () => {
  stubApi('member')
  renderShell()

  const rail = screen.getByRole('navigation', { name: 'Серверы' })
  const link = await within(rail).findByRole('link', { name: 'Команда Orbit' })
  expect(link).toHaveAttribute('aria-current', 'page')
  expect(link).toHaveTextContent('КO')

  act(() => {
    link.focus()
  })
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Команда Orbit')
})

// A member sees no buttons they may not press. The server checks anyway; this
// is about not offering what will be refused.
it('offers managing to an admin and not to a member', async () => {
  stubApi('member')
  const { unmount } = renderShell()

  expect(await screen.findByRole('link', { name: '# общий' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '+ Канал' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Участники' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Настройки сервера' })).not.toBeInTheDocument()
  unmount()

  vi.unstubAllGlobals()
  stubApi('admin')
  renderShell()

  expect(await screen.findByRole('button', { name: '+ Канал' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Участники' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Настройки сервера' })).toHaveAttribute(
    'href',
    `/s/${workspaceId}/settings`,
  )
})

// The server lets its members create channels: the button follows the flag,
// while managing members stays with admins.
it('offers a member to create a channel when the server allows it', async () => {
  stubApi('member', undefined, { ...defaultPermissions, canCreateChannels: true })
  renderShell()

  expect(await screen.findByRole('button', { name: '+ Канал' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Участники' })).not.toBeInTheDocument()
})

it('leads to the server creation page from the rail', async () => {
  stubApi('member')
  renderShell()

  const rail = screen.getByRole('navigation', { name: 'Серверы' })
  expect(await within(rail).findByRole('link', { name: 'Создать сервер' })).toHaveAttribute(
    'href',
    '/new',
  )
})

it('names the signed-in account and offers to sign out', async () => {
  stubApi('member')
  renderShell()

  expect(await screen.findByText('Anna')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument()
})

it('marks unread channels and mentions, and the server in the rail', async () => {
  stubApi('member', {
    current: [
      { channelId, lastReadSeq: 0, unread: 2, mentions: 0 },
      { channelId: otherChannelId, lastReadSeq: 0, unread: 3, mentions: 1 },
    ],
  })
  renderShell()

  expect(
    await screen.findByRole('link', { name: '# флуд, 3 непрочитанных, 1 упоминание' }),
  ).toBeInTheDocument()
  // The open channel is being read: no badge on it.
  expect(screen.getByRole('link', { name: '# общий' })).toBeInTheDocument()
  const rail = screen.getByRole('navigation', { name: 'Серверы' })
  expect(
    within(rail).getByRole('link', { name: 'Команда Orbit, 5 непрочитанных, 1 упоминание' }),
  ).toBeInTheDocument()
})

// Another device of the same account read the channel: the server tells this
// one with read.changed, and the badge goes out without a reload.
it('puts the badge out when another device reads the channel', async () => {
  const unread = {
    current: [
      { channelId, lastReadSeq: 0, unread: 0, mentions: 0 },
      { channelId: otherChannelId, lastReadSeq: 4, unread: 3, mentions: 1 },
    ],
  }
  stubApi('member', unread)
  renderShell()
  await screen.findByRole('link', { name: '# флуд, 3 непрочитанных, 1 упоминание' })

  unread.current = noUnread
  act(() => {
    sockets
      .at(-1)
      ?.receive({ type: 'read.changed', workspaceId, channelId: otherChannelId, seq: 7 })
  })

  expect(await screen.findByRole('link', { name: '# флуд' })).toBeInTheDocument()
})

// An admin let members create channels: the server says workspace.updated to
// everyone watching, and the button appears without a reload.
it('redraws the buttons when the server permissions change', async () => {
  const permissions = { ...defaultPermissions }
  stubApi('member', undefined, permissions)
  renderShell()
  await screen.findByRole('link', { name: '# общий' })
  expect(screen.queryByRole('button', { name: '+ Канал' })).not.toBeInTheDocument()

  permissions.canCreateChannels = true
  act(() => {
    sockets.at(-1)?.receive({ type: 'workspace.updated', workspaceId, payload: {} })
  })

  expect(await screen.findByRole('button', { name: '+ Канал' })).toBeInTheDocument()
})

describe('notifications', () => {
  const created = (
    author: { id: string; nickname: string },
    target: string,
    mentions: string[] = [],
  ) => {
    return {
      type: 'message.created',
      workspaceId,
      channelId: target,
      seq: 9,
      payload: {
        id: crypto.randomUUID(),
        channelId: target,
        seq: 9,
        content: 'посмотри',
        mentions,
        reactions: [],
        author: { ...author, isGuest: false, createdAt: '2026-10-18T10:00:00Z' },
        createdAt: '2026-10-20T10:00:00Z',
      },
    }
  }
  const boris = { id: 'u2', nickname: 'Boris' }

  it('notifies about a mention in another channel', async () => {
    const platform = createFakePlatform()
    setPlatform(platform)
    stubApi('member')
    renderShell()
    await screen.findByRole('link', { name: '# флуд' })

    act(() => {
      sockets.at(-1)?.receive(created(boris, otherChannelId, [anna.id]))
    })

    await waitFor(() => {
      expect(platform.notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '#флуд · Команда Orbit',
          body: 'Boris: посмотри',
          tag: otherChannelId,
        }),
      )
    })
  })

  it('stays quiet about my own messages and the open channel', async () => {
    const platform = createFakePlatform()
    setPlatform(platform)
    stubApi('member')
    renderShell()
    await screen.findByRole('link', { name: '# флуд' })

    act(() => {
      sockets.at(-1)?.receive(created(anna, otherChannelId, [anna.id]))
      sockets.at(-1)?.receive(created(boris, channelId, [anna.id]))
    })

    expect(platform.notifications.show).not.toHaveBeenCalled()
  })
})
