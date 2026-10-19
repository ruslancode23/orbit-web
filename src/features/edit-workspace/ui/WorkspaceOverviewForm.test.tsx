import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Workspace } from '@/entities/workspace'
import { renderWithProviders } from '@/shared/lib/test'

import { WorkspaceOverviewForm } from './WorkspaceOverviewForm'

const workspace: Workspace = {
  id: '0b7e6c1a-2f4d-4c1e-9a3b-5d6e7f8a9b0c',
  name: 'Команда',
  description: 'Про космос',
  iconUrl: 'https://files.test/icon.webp?sig=1',
  memberPermissions: { canInvite: false, canCreateChannels: false, canAttachFiles: true },
  ownerId: '6f1c0a9e-6b1a-4a3a-8f0e-2a4f1d2b3c4d',
  createdAt: new Date('2026-10-20T10:00:00Z'),
}

interface Call {
  method: string
  path: string
  body: unknown
}

const stubApi = (status = 200, error?: { code: string; message: string }) => {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Request) => {
      const isJson = input.headers.get('Content-Type')?.includes('json') ?? false
      calls.push({
        method: input.method,
        path: new URL(input.url).pathname,
        body: isJson ? await input.json() : null,
      })
      const body = error ? { error } : { workspace, role: 'owner' }
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const save = () => userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

it('shows the server as it is and offers nothing to save until something changes', () => {
  stubApi()
  renderWithProviders(<WorkspaceOverviewForm workspace={workspace} />)

  expect(screen.getByLabelText('Название сервера')).toHaveValue('Команда')
  expect(screen.getByLabelText(/Описание/)).toHaveValue('Про космос')
  expect(screen.getByRole('button', { name: 'Заменить' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled()
})

it('sends only what changed, and an empty description to clear it', async () => {
  const calls = stubApi()
  renderWithProviders(<WorkspaceOverviewForm workspace={workspace} />)

  await userEvent.clear(screen.getByLabelText(/Описание/))
  await save()

  expect(await screen.findByText('Сохранено')).toBeInTheDocument()
  expect(calls).toEqual([
    { method: 'PATCH', path: `/api/v1/workspaces/${workspace.id}`, body: { description: '' } },
  ])
})

it('removes the avatar without touching the text', async () => {
  const calls = stubApi()
  renderWithProviders(<WorkspaceOverviewForm workspace={workspace} />)

  await userEvent.click(screen.getByRole('button', { name: 'Убрать' }))
  await save()

  await waitFor(() => {
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      `DELETE /api/v1/workspaces/${workspace.id}/icon`,
    ])
  })
})

it('puts a refusal of the server at the name', async () => {
  stubApi(400, { code: 'invalid_request', message: 'servers: name must be 1 to 64 characters' })
  renderWithProviders(<WorkspaceOverviewForm workspace={workspace} />)

  await userEvent.type(screen.getByLabelText('Название сервера'), ' и друзья')
  await save()

  expect(await screen.findByRole('alert')).toHaveTextContent('Название — от 1 до 64 символов.')
  expect(screen.getByLabelText('Название сервера')).toHaveAttribute('aria-invalid', 'true')
})

it('says so when the role is not enough', async () => {
  stubApi(403, { code: 'forbidden', message: 'changing a server needs the admin role' })
  renderWithProviders(<WorkspaceOverviewForm workspace={workspace} />)

  await userEvent.type(screen.getByLabelText('Название сервера'), '!')
  await save()

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Для этого нужны права администратора.',
  )
})

// Another admin renamed the server: the new name shows up by itself, unless
// this person is in the middle of typing their own.
it('follows changes from elsewhere and keeps what is being typed', async () => {
  stubApi()
  const { rerender } = renderWithProviders(<WorkspaceOverviewForm workspace={workspace} />)

  rerender(<WorkspaceOverviewForm workspace={{ ...workspace, name: 'Экипаж' }} />)
  await waitFor(() => {
    expect(screen.getByLabelText('Название сервера')).toHaveValue('Экипаж')
  })

  await userEvent.type(screen.getByLabelText(/Описание/), '!')
  rerender(
    <WorkspaceOverviewForm
      workspace={{ ...workspace, name: 'Экипаж', description: 'Совсем другое' }}
    />,
  )
  await waitFor(() => {
    expect(screen.getByLabelText(/Описание/)).toHaveValue('Про космос!')
  })
})
