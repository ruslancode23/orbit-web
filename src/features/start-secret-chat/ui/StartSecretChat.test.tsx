import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

import { renderWithProviders } from '@/shared/lib/test'

import { StartSecretChat } from './StartSecretChat'

import type * as ReactRouter from 'react-router'

const navigate = vi.fn()

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof ReactRouter>('react-router')
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

const stubDevices = (
  devices: { id: string; name: string; userId: string; identityKey: string; signingKey: string }[],
) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(devices), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('StartSecretChat', () => {
  it('explains when the person has no device yet', async () => {
    stubDevices([])
    renderWithProviders(
      <MemoryRouter>
        <StartSecretChat userId="bob" nickname="Боб" />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Секретный чат' }))

    await waitFor(() => {
      expect(screen.getByText('У Боб ещё нет устройства для секретных чатов')).toBeInTheDocument()
    })
  })

  it('offers a device to choose when the person has several', async () => {
    stubDevices([
      { id: 'phone', name: 'Телефон', userId: 'bob', identityKey: 'a', signingKey: 'b' },
      { id: 'laptop', name: 'Ноутбук', userId: 'bob', identityKey: 'c', signingKey: 'd' },
    ])
    renderWithProviders(
      <MemoryRouter>
        <StartSecretChat userId="bob" nickname="Боб" />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Секретный чат' }))

    expect(await screen.findByText('Устройство собеседника')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Телефон' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ноутбук' })).toBeInTheDocument()
  })
})
