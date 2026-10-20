import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/shared/lib/test'

import { ManageInvites } from './ManageInvites'

const workspaceId = '11111111-1111-4111-8111-111111111111'

const invite = {
  id: 'inv-1',
  code: 'abc123',
  uses: 2,
  maxUses: 5,
  expiresAt: '2026-11-20T10:00:00Z',
  createdAt: '2026-10-20T10:00:00Z',
}

interface Call {
  path: string
  method: string
  body: string
}

const stubApi = () => {
  const calls: Call[] = []
  let invites = [invite]
  let created = invite
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      calls.push({
        path: url.pathname,
        method: request.method,
        body: request.method === 'GET' ? '' : await request.clone().text(),
      })

      if (request.method === 'GET' && url.pathname.endsWith('/invites')) {
        return json(invites)
      }
      if (request.method === 'POST' && url.pathname.endsWith('/invites')) {
        created = { ...invite, id: `inv-${String(invites.length + 1)}`, code: 'new-code' }
        invites = [created, ...invites]
        return json(created, 201)
      }
      if (request.method === 'DELETE' && url.pathname.includes('/invites/')) {
        invites = invites.filter((item) => !url.pathname.endsWith(item.id))
        return new Response(null, { status: 204 })
      }
      return json({})
    }),
  )
  return calls
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const open = (canManage = true) => {
  const user = userEvent.setup()
  renderWithProviders(
    <ManageInvites
      workspaceId={workspaceId}
      canInvite
      canManage={canManage}
      open
      onOpenChange={vi.fn()}
    />,
    { route: '/' },
  )
  return user
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('creates a link, shows it and copies it', async () => {
  const calls = stubApi()
  const user = open()

  await user.selectOptions(screen.getByLabelText('Срок действия'), '1 день')
  await user.click(screen.getByRole('button', { name: 'Создать ссылку' }))

  const link = await screen.findByLabelText('Ссылка-приглашение')
  if (!(link instanceof HTMLInputElement)) {
    throw new Error('the invite link is not an input')
  }
  expect(link.value).toMatch(/\/invite\/new-code$/)
  const created = calls.find((call) => call.method === 'POST')
  expect(created?.body).toContain('"expiresInHours":24')

  await user.click(screen.getByRole('button', { name: 'Копировать' }))
  expect(await screen.findByText('Ссылка скопирована')).toBeInTheDocument()
  expect(await navigator.clipboard.readText()).toMatch(/\/invite\/new-code$/)
})

it('lists the links of the server and revokes one', async () => {
  const calls = stubApi()
  const user = open()

  expect(await screen.findByText('Использовано 2 из 5')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Отозвать приглашение/ }))

  await waitFor(() => {
    expect(screen.getByText('Ссылок пока нет.')).toBeInTheDocument()
  })
  expect(calls.some((call) => call.method === 'DELETE')).toBe(true)
})

it('gives a member the link but not the list of all links', async () => {
  const calls = stubApi()
  const user = open(false)

  expect(screen.queryByText('Все ссылки')).not.toBeInTheDocument()
  expect(calls.some((call) => call.method === 'GET')).toBe(false)

  await user.click(screen.getByRole('button', { name: 'Создать ссылку' }))
  expect(await screen.findByLabelText('Ссылка-приглашение')).toBeInTheDocument()
})

it('is not offered when the server does not let this member invite', () => {
  stubApi()
  renderWithProviders(
    <ManageInvites
      workspaceId={workspaceId}
      canInvite={false}
      canManage={false}
      open
      onOpenChange={vi.fn()}
    />,
    { route: '/' },
  )

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
