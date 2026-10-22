import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/shared/lib/test'

import { RolesSettings } from './RolesSettings'

const workspaceId = '11111111-1111-4111-8111-111111111111'
const me = { id: 'u-me', nickname: 'Anna', isGuest: false, createdAt: '2026-10-18T10:00:00Z' }

const role = (id: string, name: string, position: number, permissions: string[]) => ({
  id,
  name,
  hoist: false,
  position,
  permissions,
  isDefault: false,
})

// The reader is a moderator: they manage roles and kick, but do not ban.
const roles = [
  role('r-admin', 'Админ', 4, ['administrator']),
  role('r-mod', 'Модератор', 3, ['manageRoles', 'kickMembers']),
  role('r-helper', 'Помощник', 2, []),
  role('r-junior', 'Новичок', 1, []),
  { ...role('r-everyone', '@everyone', 0, ['viewChannel', 'sendMessages']), isDefault: true },
]

const members = [{ user: me, role: 'member', joinedAt: '2026-10-18T10:00:00Z', roleIds: ['r-mod'] }]

const membership = {
  workspace: {
    id: workspaceId,
    name: 'Сервер',
    description: null,
    iconUrl: null,
    ownerId: 'u-owner',
    createdAt: '2026-10-18T10:00:00Z',
    memberPermissions: { canInvite: false, canCreateChannels: false, canAttachFiles: true },
  },
  role: 'member',
  permissions: ['manageRoles', 'kickMembers', 'viewChannel', 'sendMessages'],
}

interface Call {
  path: string
  method: string
  body: unknown
}

const stubApi = () => {
  const calls: Call[] = []
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
          : path.endsWith('/roles') && request.method === 'POST'
            ? role('r-new', 'Новая роль', 1, [])
            : path.endsWith('/roles') || path.endsWith('/roles/order')
              ? roles
              : path.startsWith('/api/v1/roles/')
                ? roles[2]
                : path === '/api/v1/workspaces'
                  ? [membership]
                  : path === `/api/v1/workspaces/${workspaceId}`
                    ? membership
                    : {}
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
  renderWithProviders(<RolesSettings workspaceId={workspaceId} />, { route: '/' })
  await screen.findByRole('list', { name: 'Роли' })
  await screen.findByRole('button', { name: 'Опустить роль Помощник' })
}

it('lets the reader move and edit only the roles below their own', async () => {
  stubApi()
  await open()

  expect(screen.queryByRole('button', { name: 'Опустить роль Админ' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Опустить роль Модератор' })).not.toBeInTheDocument()
  // Nothing may climb above the reader's own role.
  expect(screen.getByRole('button', { name: 'Поднять роль Помощник' })).toBeDisabled()

  await userEvent.click(screen.getByRole('button', { name: 'Изменить роль Админ' }))
  const editor = screen.getByRole('form', { name: 'Роль Админ' })
  expect(within(editor).getByText(/можно только посмотреть/)).toBeInTheDocument()
  expect(within(editor).queryByRole('button', { name: 'Сохранить роль' })).not.toBeInTheDocument()
})

it('sends the new order when a role moves down', async () => {
  const calls = stubApi()
  await open()

  await userEvent.click(screen.getByRole('button', { name: 'Опустить роль Помощник' }))

  await waitFor(() => {
    expect(calls).toContainEqual({
      path: `/api/v1/workspaces/${workspaceId}/roles/order`,
      method: 'PUT',
      body: { roleIds: ['r-admin', 'r-mod', 'r-junior', 'r-helper'] },
    })
  })
})

it('saves only what changed and never offers a permission the reader lacks', async () => {
  const calls = stubApi()
  await open()

  await userEvent.click(screen.getByRole('button', { name: 'Изменить роль Помощник' }))
  const editor = screen.getByRole('form', { name: 'Роль Помощник' })

  expect(within(editor).getByRole('switch', { name: 'Банить участников' })).toBeDisabled()

  const name = within(editor).getByLabelText('Название')
  await userEvent.clear(name)
  await userEvent.type(name, 'Хелпер')
  await userEvent.click(within(editor).getByRole('button', { name: 'Зелёный' }))
  await userEvent.click(within(editor).getByRole('switch', { name: 'Исключать участников' }))
  await userEvent.click(within(editor).getByRole('button', { name: 'Сохранить роль' }))

  await waitFor(() => {
    expect(calls).toContainEqual({
      path: '/api/v1/roles/r-helper',
      method: 'PATCH',
      body: { name: 'Хелпер', color: 'green', permissions: ['kickMembers'] },
    })
  })
})

it('creates a role and opens it', async () => {
  const calls = stubApi()
  await open()

  await userEvent.click(screen.getByRole('button', { name: 'Создать роль' }))

  await waitFor(() => {
    expect(calls).toContainEqual({
      path: `/api/v1/workspaces/${workspaceId}/roles`,
      method: 'POST',
      body: { name: 'Новая роль' },
    })
  })
})

it('asks before deleting a role', async () => {
  const calls = stubApi()
  await open()

  await userEvent.click(screen.getByRole('button', { name: 'Изменить роль Новичок' }))
  await userEvent.click(screen.getByRole('button', { name: 'Удалить роль' }))
  expect(calls.some((call) => call.method === 'DELETE')).toBe(false)

  await userEvent.click(screen.getByRole('button', { name: 'Удалить' }))
  await waitFor(() => {
    expect(calls).toContainEqual({
      path: '/api/v1/roles/r-junior',
      method: 'DELETE',
      body: undefined,
    })
  })
})
