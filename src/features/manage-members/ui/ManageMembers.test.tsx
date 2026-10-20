import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/shared/lib/test'

import { ManageMembers } from './ManageMembers'

const workspaceId = '11111111-1111-4111-8111-111111111111'
const me = { id: 'u-me', nickname: 'Anna', isGuest: false, createdAt: '2026-10-18T10:00:00Z' }
const bob = { id: 'u-bob', nickname: 'Bob', isGuest: false, createdAt: '2026-10-18T10:00:00Z' }
const vika = { id: 'u-vika', nickname: 'Vika', isGuest: false, createdAt: '2026-10-18T10:00:00Z' }

const members = [
  { user: me, role: 'owner' as const, joinedAt: '2026-10-18T10:00:00Z' },
  { user: bob, role: 'admin' as const, joinedAt: '2026-10-18T10:00:00Z' },
  { user: vika, role: 'member' as const, joinedAt: '2026-10-18T10:00:00Z' },
]

const stubApi = () => {
  const calls: { url: string; method: string; body: string }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      const { url } = request
      calls.push({
        url,
        method: request.method,
        body: request.method === 'GET' ? '' : await request.clone().text(),
      })
      const body = url.includes('/auth/me') ? me : url.includes('/members') ? members : {}
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

const open = async (role: 'owner' | 'admin') => {
  renderWithProviders(
    <ManageMembers workspaceId={workspaceId} role={role} open onOpenChange={vi.fn()} />,
    { route: '/' },
  )
  await screen.findByText(/Bob/)
}

it('lists the members with their roles', async () => {
  stubApi()
  await open('owner')

  expect(screen.getByText(/Anna/)).toHaveTextContent('владелец')
  expect(screen.getByText(/Bob/)).toHaveTextContent('админ')
  expect(screen.getByText(/Vika/)).toHaveTextContent('участник')
})

// Only the owner moves people between roles, and nobody moderates themselves.
it('offers role changes to the owner only, and never on themselves', async () => {
  stubApi()
  await open('owner')

  expect(screen.getByRole('button', { name: 'Снять админа' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Сделать админом' })).toBeInTheDocument()
  // Three members, and the owner is not one of the moderation targets.
  expect(screen.getAllByRole('button', { name: 'Забанить' })).toHaveLength(2)
})

it('lets an admin moderate members but not other admins', async () => {
  stubApi()
  await open('admin')

  expect(screen.queryByRole('button', { name: 'Сделать админом' })).not.toBeInTheDocument()
  // Only Vika, the plain member, can be removed by an admin.
  expect(screen.getAllByRole('button', { name: 'Убрать' })).toHaveLength(1)
})

it('asks the server to change a role', async () => {
  const calls = stubApi()
  await open('owner')

  await userEvent.click(screen.getByRole('button', { name: 'Сделать админом' }))

  await waitFor(() => {
    const call = calls.find((item) => item.method === 'PATCH')
    expect(call?.url).toContain(`/workspaces/${workspaceId}/members/${vika.id}`)
    expect(call?.body).toContain('admin')
  })
})

it('explains a refusal from the server', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown) => {
      const request = input as Request
      const { url } = request
      if (request.method === 'PATCH') {
        return Promise.resolve(
          new Response(JSON.stringify({ error: { code: 'forbidden', message: 'no' } }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
      const body = url.includes('/auth/me') ? me : url.includes('/members') ? members : {}
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }),
  )
  await open('owner')

  await userEvent.click(screen.getByRole('button', { name: 'Сделать админом' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('не хватает прав')
})
