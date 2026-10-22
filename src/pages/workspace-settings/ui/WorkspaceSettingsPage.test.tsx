import { screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

import { renderWithProviders } from '@/shared/lib/test'

import WorkspaceSettingsPage from './WorkspaceSettingsPage'

const workspaceId = '0b7e6c1a-2f4d-4c1e-9a3b-5d6e7f8a9b0c'

const stubWorkspaces = (role: 'owner' | 'admin' | 'member', permissions?: string[]) => {
  const memberships = [
    {
      workspace: {
        id: workspaceId,
        name: 'Команда',
        description: null,
        iconUrl: null,
        memberPermissions: { canInvite: false, canCreateChannels: false, canAttachFiles: true },
        ownerId: '6f1c0a9e-6b1a-4a3a-8f0e-2a4f1d2b3c4d',
        createdAt: '2026-10-20T10:00:00Z',
      },
      role,
      ...(permissions === undefined ? {} : { permissions }),
    },
  ]
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(memberships), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const renderPage = (path = `/s/${workspaceId}/settings`) =>
  renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>главная</p>} />
        <Route path="/s/:workspaceId" element={<p>сервер</p>} />
        <Route path="/s/:workspaceId/settings" element={<WorkspaceSettingsPage />} />
      </Routes>
    </MemoryRouter>,
  )

it('gives an admin the overview and the permissions, but not deleting', async () => {
  stubWorkspaces('admin')
  renderPage()

  expect(await screen.findByRole('heading', { name: 'Настройки сервера' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Обзор' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Права участников' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Удаление сервера' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Название сервера')).toHaveValue('Команда')
})

it('lets the owner delete the server', async () => {
  stubWorkspaces('owner')
  renderPage()

  expect(await screen.findByRole('region', { name: 'Удаление сервера' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Удалить сервер' })).toBeInTheDocument()
})

// Roles are their own permission: a role manager sees only that section.
it('gives someone who manages roles only the roles', async () => {
  stubWorkspaces('member', ['manageRoles', 'viewChannel'])
  renderPage()

  expect(await screen.findByRole('region', { name: 'Роли' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Обзор' })).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Права участников' })).not.toBeInTheDocument()
})

// The server would refuse every change anyway; the page does not pretend.
it('sends a member back to the server', async () => {
  stubWorkspaces('member')
  renderPage()

  expect(await screen.findByText('сервер')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Настройки сервера' })).not.toBeInTheDocument()
})

it('sends home from a server this account is not on', async () => {
  stubWorkspaces('owner')
  renderPage('/s/11111111-1111-4111-8111-111111111111/settings')

  expect(await screen.findByText('главная')).toBeInTheDocument()
})
