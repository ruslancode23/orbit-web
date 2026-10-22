import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { WorkspaceMember } from '@/entities/workspace'
import { renderWithProviders } from '@/shared/lib/test'

import { MemberRoles } from './MemberRoles'

const workspaceId = '11111111-1111-4111-8111-111111111111'
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

const member = (id: string, roleIds: string[]): WorkspaceMember => ({
  user: {
    id,
    nickname: id,
    displayName: '',
    accentColor: 'slate',
    bio: '',
    isGuest: false,
    createdAt: new Date('2026-10-18T10:00:00Z'),
  },
  role: 'member',
  joinedAt: new Date('2026-10-18T10:00:00Z'),
  roleIds,
})

const vika = member('u-vika', ['r-helper'])
const boss = member('u-boss', ['r-admin'])

const stubApi = (permissions: string[]) => {
  const calls: { path: string; method: string }[] = []
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
    permissions,
  }
  const members = [
    { user: me, role: 'member', joinedAt: '2026-10-18T10:00:00Z', roleIds: ['r-mod'] },
    { ...vika, joinedAt: '2026-10-18T10:00:00Z' },
    { ...boss, joinedAt: '2026-10-18T10:00:00Z' },
  ]
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      const path = new URL(request.url).pathname
      calls.push({ path, method: request.method })
      const body = path.endsWith('/auth/me')
        ? me
        : path.endsWith('/members')
          ? members
          : path.endsWith('/roles')
            ? roles
            : path.includes('/roles/')
              ? members[1]
              : path === '/api/v1/workspaces'
                ? [membership]
                : path === `/api/v1/workspaces/${workspaceId}`
                  ? membership
                  : {}
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }),
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('gives and takes roles below the reader’s own', async () => {
  const calls = stubApi(['manageRoles'])
  renderWithProviders(<MemberRoles workspaceId={workspaceId} member={vika} />, { route: '/' })

  const helper = await screen.findByRole('switch', { name: 'Роль Помощник' })
  await waitFor(() => {
    expect(helper).toBeEnabled()
  })
  expect(helper).toBeChecked()
  // Their own role and anything above it are not theirs to give.
  expect(screen.getByRole('switch', { name: 'Роль Модератор' })).toBeDisabled()
  expect(screen.getByRole('switch', { name: 'Роль Админ' })).toBeDisabled()

  await userEvent.click(helper)
  await waitFor(() => {
    expect(calls).toContainEqual({
      path: `/api/v1/workspaces/${workspaceId}/members/u-vika/roles/r-helper`,
      method: 'DELETE',
    })
  })
})

it('locks every role on a member who is not below the reader', async () => {
  stubApi(['manageRoles'])
  renderWithProviders(<MemberRoles workspaceId={workspaceId} member={boss} />, { route: '/' })

  await screen.findByRole('switch', { name: 'Роль Помощник' })
  for (const name of ['Роль Админ', 'Роль Модератор', 'Роль Помощник']) {
    expect(screen.getByRole('switch', { name })).toBeDisabled()
  }
})

it('shows nothing without manageRoles', async () => {
  const calls = stubApi(['kickMembers'])
  renderWithProviders(<MemberRoles workspaceId={workspaceId} member={vika} />, { route: '/' })

  await waitFor(() => {
    expect(calls.some((call) => call.path.endsWith('/roles'))).toBe(true)
  })
  expect(screen.queryByRole('group', { name: 'Роли' })).not.toBeInTheDocument()
})
