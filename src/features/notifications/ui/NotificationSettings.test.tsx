import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createFakePlatform, renderWithProviders } from '@/shared/lib/test'
import { setPlatform } from '@/shared/platform'

import { NotificationSettings } from './NotificationSettings'
import { setNotificationMode } from '../model/mode'

let platform: ReturnType<typeof createFakePlatform>

beforeEach(() => {
  setNotificationMode('mentions')
  platform = createFakePlatform()
  setPlatform(platform)
})

afterEach(() => {
  setPlatform(null)
})

it('does not ask for permission just by being shown', () => {
  platform.notifications.permission.mockReturnValue('default')
  renderWithProviders(<NotificationSettings />)

  expect(screen.getByRole('combobox', { name: 'Уведомления' })).toHaveValue('mentions')
  expect(platform.notifications.requestPermission).not.toHaveBeenCalled()
})

it('asks for permission when the person turns notifications on', async () => {
  platform.notifications.permission.mockReturnValue('default')
  renderWithProviders(<NotificationSettings />)

  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Уведомления' }), 'all')

  expect(platform.notifications.requestPermission).toHaveBeenCalledOnce()
  expect(screen.queryByRole('button', { name: 'Разрешить уведомления' })).not.toBeInTheDocument()
})

it('offers a button to allow them, and asks only when pressed', async () => {
  platform.notifications.permission.mockReturnValue('default')
  renderWithProviders(<NotificationSettings />)

  await userEvent.click(screen.getByRole('button', { name: 'Разрешить уведомления' }))

  expect(platform.notifications.requestPermission).toHaveBeenCalledOnce()
})

it('remembers the choice', async () => {
  const { unmount } = renderWithProviders(<NotificationSettings />)
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Уведомления' }), 'off')
  unmount()

  renderWithProviders(<NotificationSettings />)
  expect(screen.getByRole('combobox', { name: 'Уведомления' })).toHaveValue('off')
})

it('explains when the browser refused', () => {
  platform.notifications.permission.mockReturnValue('denied')
  renderWithProviders(<NotificationSettings />)

  expect(screen.getByText(/Браузер запретил уведомления/)).toBeInTheDocument()
})
