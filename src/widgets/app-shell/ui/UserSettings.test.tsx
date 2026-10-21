import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/shared/lib/test'

import { UserSettings } from './UserSettings'

// The other tabs reach for devices, notifications and the install prompt; the
// guard under test only needs a placeholder where they would be.
vi.mock('@/features/select-device', () => ({
  DeviceSettings: () => <p>Настройки устройств</p>,
}))
vi.mock('@/features/notifications', () => ({
  NotificationSettings: () => <p>Настройки уведомлений</p>,
}))
vi.mock('@/features/install-app', () => ({
  InstallApp: () => null,
}))

const me = {
  id: 'u-me',
  nickname: 'anna',
  displayName: 'Анна',
  accentColor: 'violet',
  bio: 'Пишу код.',
  isGuest: false,
  email: 'anna@example.com',
  createdAt: '2026-10-18T10:00:00Z',
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      if (url.pathname === '/api/v1/auth/me') {
        return Promise.resolve(json(me))
      }
      return Promise.resolve(json({}))
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const renderSettings = () => {
  const onOpenChange = vi.fn()
  const view = renderWithProviders(<UserSettings open onOpenChange={onOpenChange} />, {
    route: '/',
  })
  return { ...view, onOpenChange }
}

it('asks before leaving the profile tab with unsaved edits', async () => {
  renderSettings()
  const form = await screen.findByRole('form', { name: 'Профиль' })
  const bio = within(form).getByLabelText('О себе')

  await userEvent.type(bio, ' Черновик')
  await userEvent.click(screen.getByRole('tab', { name: 'Уведомления' }))

  const confirm = await screen.findByRole('dialog', { name: 'Не сохранять изменения?' })
  await userEvent.click(screen.getByRole('button', { name: 'Остаться' }))

  await waitFor(() => {
    expect(confirm).not.toBeInTheDocument()
  })
  expect(within(form).getByLabelText('О себе')).toHaveValue('Пишу код. Черновик')
  expect(screen.queryByText('Настройки уведомлений')).not.toBeInTheDocument()
})

it('moves to another tab when the edits are discarded', async () => {
  renderSettings()
  const form = await screen.findByRole('form', { name: 'Профиль' })

  await userEvent.type(within(form).getByLabelText('О себе'), ' Черновик')
  await userEvent.click(screen.getByRole('tab', { name: 'Уведомления' }))
  await screen.findByRole('dialog', { name: 'Не сохранять изменения?' })
  await userEvent.click(screen.getByRole('button', { name: 'Уйти без сохранения' }))

  expect(await screen.findByText('Настройки уведомлений')).toBeInTheDocument()
  expect(screen.queryByRole('form', { name: 'Профиль' })).not.toBeInTheDocument()
})

it('switches tabs without asking when nothing is dirty', async () => {
  renderSettings()
  await screen.findByRole('form', { name: 'Профиль' })

  await userEvent.click(screen.getByRole('tab', { name: 'Уведомления' }))

  expect(await screen.findByText('Настройки уведомлений')).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: 'Не сохранять изменения?' })).not.toBeInTheDocument()
})
