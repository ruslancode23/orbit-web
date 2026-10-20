import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createFakePlatform, renderWithProviders } from '@/shared/lib/test'
import { setPlatform } from '@/shared/platform'

import { InstallApp } from './InstallApp'

const installable = () => {
  const platform = createFakePlatform()
  let available = true
  const listeners = new Set<() => void>()
  platform.install.canPrompt.mockImplementation(() => available)
  platform.install.onChange.mockImplementation((listener) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  })
  platform.install.prompt.mockImplementation(() => {
    available = false
    for (const listener of listeners) {
      listener()
    }
    return Promise.resolve('accepted')
  })
  setPlatform(platform)
  return platform
}

afterEach(() => {
  setPlatform(null)
})

it('offers the install prompt while the browser has one', async () => {
  const platform = installable()
  renderWithProviders(<InstallApp />, { route: '/' })

  await userEvent.click(screen.getByRole('button', { name: 'Установить приложение' }))

  expect(platform.install.prompt).toHaveBeenCalled()
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: 'Установить приложение' })).not.toBeInTheDocument()
  })
})

it('stays away when the browser has no prompt to offer', () => {
  setPlatform(createFakePlatform())
  renderWithProviders(<InstallApp />, { route: '/' })

  expect(screen.queryByRole('button', { name: 'Установить приложение' })).not.toBeInTheDocument()
})

it('stays away once Orbit runs as an installed app', () => {
  const platform = installable()
  platform.install.isInstalled.mockReturnValue(true)
  renderWithProviders(<InstallApp />, { route: '/' })

  expect(screen.queryByRole('button', { name: 'Установить приложение' })).not.toBeInTheDocument()
})

it('stays away when the browser cannot install web apps', () => {
  const platform = installable()
  platform.install.isSupported.mockReturnValue(false)
  renderWithProviders(<InstallApp />, { route: '/' })

  expect(screen.queryByRole('button', { name: 'Установить приложение' })).not.toBeInTheDocument()
})
