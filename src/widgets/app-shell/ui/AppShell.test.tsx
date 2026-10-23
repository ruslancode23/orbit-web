import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'

import { LiveProvider, setPresenceChoice } from '@/entities/live'
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
    kind: 'text',
    name: 'общий',
    position: 0,
    isReadOnly: false,
    canWrite: true,
    createdAt: '2026-10-18T10:00:00Z',
  },
  {
    id: otherChannelId,
    workspaceId,
    kind: 'text',
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
interface ConversationUnread {
  unread: number
  mentions: number
}

const stubApi = (
  role: Role,
  unread: { current: Counts } = { current: noUnread },
  memberPermissions = defaultPermissions,
  friendRequests: unknown[] = [],
  session: object = anna,
  conversationUnread: ConversationUnread = { unread: 0, mentions: 0 },
) => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown) => {
      const url = input instanceof Request ? input.url : String(input)
      const body = url.includes('/auth/me')
        ? session
        : url.includes('/friends/requests')
          ? friendRequests
          : url.includes('/conversations/unread')
            ? conversationUnread
            : url.includes('/conversations')
              ? { conversations: [] }
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
  // The chosen status is kept on the device; «Не беспокоить» would silence the next test.
  setPresenceChoice('auto')
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
  expect(screen.getByRole('heading', { name: 'Команда Orbit', level: 2 })).toBeInTheDocument()
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

// A member sees no actions they may not take. The server checks anyway; this
// is about not offering what will be refused.
it('offers managing to an admin and not to a member', async () => {
  stubApi('member')
  const { unmount } = renderShell()

  await screen.findByRole('link', { name: '# общий' })
  await userEvent.click(screen.getByRole('button', { name: 'Меню сервера' }))
  expect(screen.queryByRole('menuitem', { name: 'Создать канал' })).not.toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Участники и баны' })).not.toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Настройки сервера' })).not.toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  unmount()

  vi.unstubAllGlobals()
  stubApi('admin')
  renderShell()

  await screen.findByRole('link', { name: '# общий' })
  await userEvent.click(screen.getByRole('button', { name: 'Меню сервера' }))
  expect(await screen.findByRole('menuitem', { name: 'Создать канал' })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Участники и баны' })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Настройки сервера' })).toBeInTheDocument()
})

// The server lets its members create channels: the menu follows the flag,
// while managing members stays with admins.
it('offers a member to create a channel when the server allows it', async () => {
  stubApi('member', undefined, { ...defaultPermissions, canCreateChannels: true })
  renderShell()

  await screen.findByRole('link', { name: '# общий' })
  await userEvent.click(screen.getByRole('button', { name: 'Меню сервера' }))
  expect(await screen.findByRole('menuitem', { name: 'Создать канал' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Участники и баны' })).not.toBeInTheDocument()
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
  await userEvent.click(screen.getByRole('button', { name: 'Настройки пользователя' }))
  await userEvent.click(await screen.findByRole('tab', { name: 'Аккаунт' }))

  expect(await screen.findByRole('button', { name: 'Выйти' })).toBeInTheDocument()
})

it('paints the avatar dot with the chosen status, not with the connection', async () => {
  stubApi('member')
  renderShell()
  const panel = await screen.findByRole('region', { name: 'Пользователь' })
  const dot = () => panel.querySelector('[data-status]')
  await vi.waitFor(() => {
    expect(dot()).toHaveAttribute('data-status', 'online')
  })

  await userEvent.click(within(panel).getByRole('button', { name: /Открыть меню статуса/ }))
  await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Не беспокоить' }))

  expect(dot()).toHaveAttribute('data-status', 'dnd')
  expect(dot()).toHaveClass('bg-danger')
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
// everyone watching, and the menu item appears without a reload.
it('redraws the buttons when the server permissions change', async () => {
  const permissions = { ...defaultPermissions }
  stubApi('member', undefined, permissions)
  renderShell()
  await screen.findByRole('link', { name: '# общий' })
  await userEvent.click(screen.getByRole('button', { name: 'Меню сервера' }))
  expect(screen.queryByRole('menuitem', { name: 'Создать канал' })).not.toBeInTheDocument()

  permissions.canCreateChannels = true
  act(() => {
    sockets.at(-1)?.receive({ type: 'workspace.updated', workspaceId, payload: {} })
  })

  expect(await screen.findByRole('menuitem', { name: 'Создать канал' })).toBeInTheDocument()
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

// Unread messages and incoming friendship requests are different things: the
// rail shows both numbers, separately, and says both in the link's name.
it('keeps incoming friendship requests apart from unread messages in the rail', async () => {
  stubApi(
    'member',
    { current: noUnread },
    defaultPermissions,
    [
      {
        userId: 'u-eva',
        nickname: 'eva',
        direction: 'incoming',
        createdAt: '2026-10-18T10:00:00Z',
      },
    ],
    anna,
    { unread: 3, mentions: 0 },
  )
  renderShell()

  const link = await screen.findByRole('link', { name: /Личные сообщения/ })

  await waitFor(() => {
    expect(link).toHaveAccessibleName('Личные сообщения, 3 непрочитанных, 1 входящая заявка')
  })
  expect(within(link).getByText('3')).toBeInTheDocument()
  expect(within(link).getByText('1')).toBeInTheDocument()
})

it('reminds about a missing photo on the avatar and in the status menu', async () => {
  stubApi('member', undefined, defaultPermissions, [], {
    ...anna,
    displayName: 'Anna',
    accentColor: 'violet',
    bio: '',
    email: null,
  })
  renderShell()

  const dot = await screen.findByRole('button', { name: 'Добавить фото профиля' })
  await userEvent.click(dot)

  const settings = await screen.findByRole('dialog', { name: 'Настройки пользователя' })
  expect(within(settings).getByRole('form', { name: 'Профиль' })).toBeInTheDocument()
})

it('offers «Добавить фото» in the status menu only while there is no picture', async () => {
  stubApi('member', undefined, defaultPermissions, [], {
    ...anna,
    displayName: 'Anna',
    accentColor: 'violet',
    bio: '',
    email: null,
  })
  const { unmount } = renderShell()

  await screen.findByText('Anna')
  await userEvent.click(screen.getByRole('button', { name: /Статус:/ }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Добавить фото' }))
  expect(await screen.findByRole('dialog', { name: 'Настройки пользователя' })).toBeInTheDocument()
  unmount()

  vi.unstubAllGlobals()
  stubApi('member', undefined, defaultPermissions, [], {
    ...anna,
    displayName: 'Anna',
    accentColor: 'violet',
    bio: '',
    email: null,
    avatarUrl: 'https://files.test/anna.webp?signature=1',
  })
  renderShell()

  await screen.findByText('Anna')
  expect(screen.queryByRole('button', { name: 'Добавить фото профиля' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Статус:/ }))
  expect(screen.queryByRole('menuitem', { name: 'Добавить фото' })).not.toBeInTheDocument()
})

describe('context menus', () => {
  /** On top of `stubApi`: the newest message of each channel and the read cursor. */
  const stubReading = (unread: { current: Counts }) => {
    const base = globalThis.fetch
    const read: { channelId: string; seq: unknown }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: Request) => {
        const url = new URL(input.url)
        const json = (body: unknown) =>
          new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
        const match = /\/channels\/([^/]+)\/(messages|read)$/.exec(url.pathname)
        if (match?.[2] === 'messages' && input.method === 'GET') {
          return json({
            messages: [
              {
                id: '44444444-4444-4444-8444-444444444444',
                channelId: match[1],
                seq: 7,
                kind: 'user',
                content: 'новое',
                mentions: [],
                reactions: [],
                createdAt: '2026-10-22T10:00:00Z',
              },
            ],
          })
        }
        if (match?.[2] === 'read') {
          const { seq } = (await input.clone().json()) as { seq: unknown }
          read.push({ channelId: match[1] ?? '', seq })
          unread.current = unread.current.map((item) =>
            item.channelId === match[1]
              ? { ...item, lastReadSeq: 7, unread: 0, mentions: 0 }
              : item,
          )
          return json({ channelId: match[1], lastReadSeq: 7, unread: 0, mentions: 0 })
        }
        return base(input)
      }),
    )
    return read
  }

  it('marks one channel read from its row', async () => {
    const unread = {
      current: [
        { channelId, lastReadSeq: 0, unread: 0, mentions: 0 },
        { channelId: otherChannelId, lastReadSeq: 0, unread: 3, mentions: 1 },
      ],
    }
    stubApi('member', unread)
    const read = stubReading(unread)
    renderShell()

    const row = await screen.findByRole('link', { name: '# флуд, 3 непрочитанных, 1 упоминание' })
    fireEvent.contextMenu(row)
    const menu = screen.getByRole('menu', { name: 'Действия с каналом флуд' })
    // A member without the rights sees no invite and no settings.
    expect(within(menu).queryByRole('menuitem', { name: 'Настройки канала' })).toBeNull()
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Отметить прочитанным' }))

    expect(await screen.findByRole('link', { name: '# флуд' })).toBeInTheDocument()
    expect(read).toEqual([{ channelId: otherChannelId, seq: 7 }])
  })

  it('offers channel settings to an admin', async () => {
    stubApi('admin')
    renderShell()

    fireEvent.contextMenu(await screen.findByRole('link', { name: '# флуд' }))
    const menu = screen.getByRole('menu', { name: 'Действия с каналом флуд' })
    expect(within(menu).getByRole('menuitem', { name: 'Отметить прочитанным' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Настройки канала' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('reads a whole server from the rail', async () => {
    const unread = {
      current: [
        { channelId, lastReadSeq: 0, unread: 2, mentions: 0 },
        { channelId: otherChannelId, lastReadSeq: 0, unread: 3, mentions: 1 },
      ],
    }
    stubApi('member', unread)
    const read = stubReading(unread)
    renderShell()

    const rail = screen.getByRole('navigation', { name: 'Серверы' })
    fireEvent.contextMenu(
      await within(rail).findByRole('link', {
        name: 'Команда Orbit, 5 непрочитанных, 1 упоминание',
      }),
    )
    const menu = screen.getByRole('menu', { name: 'Действия с сервером Команда Orbit' })
    expect(within(menu).queryByRole('menuitem', { name: 'Настройки сервера' })).toBeNull()
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Отметить прочитанным' }))

    expect(await within(rail).findByRole('link', { name: 'Команда Orbit' })).toBeInTheDocument()
    expect(read.map((item) => item.channelId).sort()).toEqual([channelId, otherChannelId].sort())
  })
})
