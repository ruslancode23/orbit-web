import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/shared/lib/test'

import { LogoutButton } from './LogoutButton'

vi.mock('../model/clear-secret-chats', () => ({ clearSecretChats: () => Promise.resolve() }))

const stubLogout = (order: string[]) => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: Request) => {
      order.push(`${input.method} ${new URL(input.url).pathname}`)
      return Promise.resolve(new Response(null, { status: 204 }))
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('cleans up the device while the session still works, then signs out', async () => {
  const order: string[] = []
  stubLogout(order)
  const beforeSignOut = vi.fn(() => {
    order.push('cleanup')
    return Promise.resolve()
  })
  renderWithProviders(<LogoutButton beforeSignOut={beforeSignOut} />, { route: '/me' })

  await userEvent.click(screen.getByRole('button', { name: 'Выйти' }))

  await waitFor(() => {
    expect(order).toContain('POST /api/v1/auth/logout')
  })
  expect(order.indexOf('cleanup')).toBeLessThan(order.indexOf('POST /api/v1/auth/logout'))
})

it('signs out even when the cleanup fails', async () => {
  const order: string[] = []
  stubLogout(order)
  renderWithProviders(<LogoutButton beforeSignOut={() => Promise.reject(new Error('offline'))} />, {
    route: '/me',
  })

  await userEvent.click(screen.getByRole('button', { name: 'Выйти' }))

  await waitFor(() => {
    expect(order).toContain('POST /api/v1/auth/logout')
  })
})
