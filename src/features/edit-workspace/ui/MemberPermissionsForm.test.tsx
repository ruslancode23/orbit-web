import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Workspace } from '@/entities/workspace'
import { renderWithProviders } from '@/shared/lib/test'

import { MemberPermissionsForm } from './MemberPermissionsForm'

const workspace: Workspace = {
  id: '0b7e6c1a-2f4d-4c1e-9a3b-5d6e7f8a9b0c',
  name: 'Команда',
  description: null,
  iconUrl: null,
  memberPermissions: { canInvite: false, canCreateChannels: true, canAttachFiles: true },
  ownerId: '6f1c0a9e-6b1a-4a3a-8f0e-2a4f1d2b3c4d',
  createdAt: new Date('2026-10-20T10:00:00Z'),
}

const stubApi = (status = 200) => {
  const bodies: unknown[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Request) => {
      bodies.push(await input.json())
      const body =
        status === 200
          ? { workspace, role: 'admin' }
          : { error: { code: 'internal', message: 'boom' } }
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
  return bodies
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('shows the flags of the server and sends only the ones changed', async () => {
  const bodies = stubApi()
  renderWithProviders(<MemberPermissionsForm workspace={workspace} />)

  expect(screen.getByRole('switch', { name: 'Создавать каналы' })).toBeChecked()
  expect(screen.getByRole('button', { name: 'Сохранить права' })).toBeDisabled()

  await userEvent.click(screen.getByRole('switch', { name: 'Приглашать людей' }))
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить права' }))

  expect(await screen.findByText('Сохранено')).toBeInTheDocument()
  expect(bodies).toEqual([{ memberPermissions: { canInvite: true } }])
})

it('keeps the switches as set when saving fails', async () => {
  stubApi(500)
  renderWithProviders(<MemberPermissionsForm workspace={workspace} />)

  await userEvent.click(screen.getByRole('switch', { name: 'Прикреплять файлы' }))
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить права' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Не получилось сохранить права.')
  expect(screen.getByRole('switch', { name: 'Прикреплять файлы' })).not.toBeChecked()
})
