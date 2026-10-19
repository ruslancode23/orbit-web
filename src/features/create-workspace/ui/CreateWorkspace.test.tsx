import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/shared/lib/test'

import { CreateWorkspace } from './CreateWorkspace'

import type * as ReactRouterModule from 'react-router'

type ReactRouter = typeof ReactRouterModule

const navigate = vi.fn()
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<ReactRouter>()),
  useNavigate: () => navigate,
}))

const membership = {
  workspace: {
    id: '0b7e6c1a-2f4d-4c1e-9a3b-5d6e7f8a9b0c',
    name: 'Команда',
    ownerId: '6f1c0a9e-6b1a-4a3a-8f0e-2a4f1d2b3c4d',
    createdAt: '2026-10-20T10:00:00Z',
  },
  role: 'owner',
}

const answerWith = (status: number, body: unknown) => {
  const fetch = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

beforeEach(() => {
  navigate.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const openDialog = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Создать сервер' }))
  return screen.getByRole('dialog', { name: 'Создать сервер' })
}

it('opens a dialog with the name field focused', async () => {
  renderWithProviders(<CreateWorkspace />, { route: '/' })

  await openDialog()

  expect(screen.getByLabelText('Название сервера')).toHaveFocus()
})

it('creates the server, closes the dialog and opens the server', async () => {
  answerWith(201, membership)
  renderWithProviders(<CreateWorkspace />, { route: '/' })

  await openDialog()
  await userEvent.type(screen.getByLabelText('Название сервера'), '  Команда ')
  await userEvent.click(screen.getByRole('button', { name: 'Создать' }))

  await waitFor(() => {
    expect(navigate).toHaveBeenCalledWith(`/s/${membership.workspace.id}`)
  })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('does not send a blank name', async () => {
  const fetch = answerWith(201, membership)
  renderWithProviders(<CreateWorkspace />, { route: '/' })

  await openDialog()
  await userEvent.type(screen.getByLabelText('Название сервера'), '   ')
  await userEvent.click(screen.getByRole('button', { name: 'Создать' }))

  await waitFor(() => {
    expect(screen.getByLabelText('Название сервера')).toHaveAttribute('aria-invalid', 'true')
  })
  expect(fetch).not.toHaveBeenCalled()
})

it('shows the error and keeps the dialog open when the server refuses', async () => {
  answerWith(500, { error: { code: 'internal', message: 'boom' } })
  renderWithProviders(<CreateWorkspace />, { route: '/' })

  await openDialog()
  await userEvent.type(screen.getByLabelText('Название сервера'), 'Команда')
  await userEvent.click(screen.getByRole('button', { name: 'Создать' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Не получилось создать сервер.')
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(navigate).not.toHaveBeenCalled()
})

it.each([
  ['Отмена', () => userEvent.click(screen.getByRole('button', { name: 'Отмена' }))],
  ['Esc', () => userEvent.keyboard('{Escape}')],
])('closes on %s and forgets what was typed and the error', async (_, close) => {
  answerWith(500, { error: { code: 'internal', message: 'boom' } })
  renderWithProviders(<CreateWorkspace />, { route: '/' })

  await openDialog()
  await userEvent.type(screen.getByLabelText('Название сервера'), 'Команда')
  await userEvent.click(screen.getByRole('button', { name: 'Создать' }))
  await screen.findByRole('alert')

  await close()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await openDialog()
  expect(screen.getByLabelText('Название сервера')).toHaveValue('')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
