import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Workspace } from '@/entities/workspace'
import { renderWithProviders } from '@/shared/lib/test'

import { DeleteWorkspace } from './DeleteWorkspace'

import type * as ReactRouterModule from 'react-router'

const navigate = vi.fn()
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouterModule>()),
  useNavigate: () => navigate,
}))

const workspace: Workspace = {
  id: '0b7e6c1a-2f4d-4c1e-9a3b-5d6e7f8a9b0c',
  name: 'Команда',
  description: null,
  iconUrl: null,
  memberPermissions: { canInvite: false, canCreateChannels: false, canAttachFiles: true },
  ownerId: '6f1c0a9e-6b1a-4a3a-8f0e-2a4f1d2b3c4d',
  createdAt: new Date('2026-10-20T10:00:00Z'),
}

const stubApi = (status: number) => {
  const fetch = vi.fn((_request: Request) => {
    const body =
      status === 204 ? null : JSON.stringify({ error: { code: 'forbidden', message: 'no' } })
    return Promise.resolve(
      new Response(body, { status, headers: { 'Content-Type': 'application/json' } }),
    )
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

beforeEach(() => {
  navigate.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const open = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Удалить сервер' }))
  return screen.getByRole('dialog', { name: 'Удалить сервер «Команда»?' })
}

it('deletes only after the name is typed, then goes home', async () => {
  const fetch = stubApi(204)
  renderWithProviders(<DeleteWorkspace workspace={workspace} />, { route: '/' })

  await open()
  const confirm = screen.getByRole('button', { name: 'Удалить навсегда' })
  expect(confirm).toBeDisabled()

  const input = screen.getByLabelText('Введите название сервера, чтобы подтвердить')
  await userEvent.type(input, 'Коман')
  expect(confirm).toBeDisabled()
  await userEvent.type(input, 'да{Enter}')

  await waitFor(() => {
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })
  const [request] = fetch.mock.lastCall ?? []
  expect(request?.method).toBe('DELETE')
  expect(request?.url).toContain(`/api/v1/workspaces/${workspace.id}`)
})

it('does not delete on Enter before the name matches', async () => {
  const fetch = stubApi(204)
  renderWithProviders(<DeleteWorkspace workspace={workspace} />, { route: '/' })

  await open()
  await userEvent.type(
    screen.getByLabelText('Введите название сервера, чтобы подтвердить'),
    'команда{Enter}',
  )

  expect(fetch).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('keeps the dialog open and says why when the server refuses', async () => {
  stubApi(403)
  renderWithProviders(<DeleteWorkspace workspace={workspace} />, { route: '/' })

  await open()
  await userEvent.type(
    screen.getByLabelText('Введите название сервера, чтобы подтвердить'),
    'Команда',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Удалить навсегда' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('только владелец')
  expect(navigate).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('button', { name: 'Отмена' }))
  await open()
  expect(screen.getByLabelText('Введите название сервера, чтобы подтвердить')).toHaveValue('')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
