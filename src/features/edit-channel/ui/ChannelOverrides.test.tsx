import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Channel } from '@/entities/channel'
import { renderWithProviders } from '@/shared/lib/test'

import { ChannelOverrides } from './ChannelOverrides'

const workspaceId = '11111111-1111-4111-8111-111111111111'
const channelId = '22222222-2222-4222-8222-222222222222'
const me = { id: 'u-me', nickname: 'Anna', isGuest: false, createdAt: '2026-10-18T10:00:00Z' }

const role = (id: string, name: string, position: number) => ({
  id,
  name,
  hoist: false,
  position,
  permissions: [],
  isDefault: false,
})

const roles = [
  role('r-admin', 'Админ', 3),
  role('r-mod', 'Модератор', 2),
  role('r-helper', 'Помощник', 1),
  { ...role('r-everyone', '@everyone', 0), isDefault: true },
]

// The reader manages channels and may write, but may not speak here.
const channel: Channel = {
  id: channelId,
  workspaceId,
  kind: 'text',
  name: 'общий',
  position: 0,
  isReadOnly: true,
  canWrite: true,
  permissions: ['manageChannels', 'viewChannel', 'sendMessages'],
  createdAt: new Date('2026-10-18T10:00:00Z'),
}

interface Call {
  path: string
  method: string
  body: unknown
}

const stubApi = () => {
  const calls: Call[] = []
  const members = [
    { user: me, role: 'member', joinedAt: '2026-10-18T10:00:00Z', roleIds: ['r-mod'] },
  ]
  const overrides = [{ roleId: 'r-everyone', allow: [], deny: ['sendMessages'] }]
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      const path = new URL(request.url).pathname
      const text = request.method === 'GET' ? '' : await request.text()
      calls.push({ path, method: request.method, body: text === '' ? undefined : JSON.parse(text) })
      const body = path.endsWith('/auth/me')
        ? me
        : path.endsWith('/members')
          ? members
          : path.endsWith('/roles')
            ? roles
            : path.includes('/overrides')
              ? overrides
              : []
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const open = async () => {
  renderWithProviders(<ChannelOverrides workspaceId={workspaceId} channel={channel} />, {
    route: '/',
  })
  return screen.findByRole('form', { name: 'Права роли @everyone в канале' })
}

it('starts with @everyone and saves its overrides together', async () => {
  const calls = stubApi()
  const form = await open()

  const write = within(form).getByRole('group', { name: 'Писать сообщения' })
  await waitFor(() => {
    expect(within(write).getByRole('radio', { name: 'Запретить' })).toBeChecked()
  })

  const view = within(form).getByRole('group', { name: 'Видеть каналы' })
  await userEvent.click(within(view).getByRole('radio', { name: 'Запретить' }))
  await userEvent.click(within(form).getByRole('button', { name: 'Сохранить права' }))

  await waitFor(() => {
    expect(calls).toContainEqual({
      path: `/api/v1/channels/${channelId}/overrides/r-everyone`,
      method: 'PUT',
      body: { allow: [], deny: ['viewChannel', 'sendMessages'] },
    })
  })
})

it('locks what the reader lacks in the channel', async () => {
  stubApi()
  const form = await open()

  const speak = within(form).getByRole('group', { name: 'Говорить в голосе' })
  expect(within(speak).getByRole('radio', { name: 'Разрешить' })).toBeDisabled()
})

it('shows a role above the reader without letting them change it', async () => {
  stubApi()
  await open()

  await userEvent.click(screen.getByRole('button', { name: 'Права роли Админ' }))
  const form = screen.getByRole('form', { name: 'Права роли Админ в канале' })

  expect(within(form).getByText(/можно только посмотреть/)).toBeInTheDocument()
  expect(within(form).queryByRole('button', { name: 'Сохранить права' })).not.toBeInTheDocument()
})
