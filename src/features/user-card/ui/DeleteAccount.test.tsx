import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { SelfProfile } from '@/shared/api'
import { renderWithProviders } from '@/shared/lib/test'

import { DeleteAccount } from './DeleteAccount'

import type * as ReactRouterModule from 'react-router'

const navigate = vi.fn()
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouterModule>()),
  useNavigate: () => navigate,
}))

const me: SelfProfile = {
  id: 'u-me',
  nickname: 'anna',
  displayName: 'Анна',
  accentColor: 'violet',
  bio: '',
  isGuest: false,
  email: 'anna@example.com',
  profileOnboardedAt: null,
  createdAt: new Date('2026-10-18T10:00:00Z'),
}

const guest: SelfProfile = {
  ...me,
  nickname: 'Гость',
  isGuest: true,
  email: null,
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

interface Call {
  method: string
  path: string
  body?: unknown
}

const stubApi = (status: number, body: unknown = null) => {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      calls.push({
        method: request.method,
        path: url.pathname,
        body:
          request.method === 'DELETE'
            ? await request
                .clone()
                .json()
                .catch(() => null)
            : undefined,
      })
      if (status === 204) {
        return new Response(null, { status })
      }
      return json(body, status)
    }),
  )
  return calls
}

const renderDanger = (profile: SelfProfile = me) =>
  renderWithProviders(<DeleteAccount profile={profile} />, { route: '/me' })

const openDialog = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Удалить аккаунт' }))
  return screen.getByRole('dialog', { name: 'Удалить аккаунт?' })
}

beforeEach(() => {
  navigate.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('keeps the account and explains server ownership on 409', async () => {
  stubApi(409, { error: { code: 'conflict', message: 'the account owns a server' } })
  renderDanger()
  const dialog = await openDialog()

  await userEvent.type(within(dialog).getByLabelText('Пароль'), 'correct-password')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Удалить навсегда' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Вы владелец сервера')
  expect(within(dialog).getByRole('alert')).toHaveTextContent('передан другому участнику')
  expect(navigate).not.toHaveBeenCalled()
})

it('puts a wrong password on the password field, not on the session', async () => {
  stubApi(401, { error: { code: 'unauthorized', message: 'wrong password' } })
  renderDanger()
  const dialog = await openDialog()

  await userEvent.type(within(dialog).getByLabelText('Пароль'), 'wrong-password')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Удалить навсегда' }))

  expect(await within(dialog).findByText('Неверный пароль.')).toBeInTheDocument()
  expect(within(dialog).getByLabelText('Пароль')).toHaveAttribute('aria-invalid', 'true')
  expect(navigate).not.toHaveBeenCalled()
})

it('deletes with the password and starts over at the sign-in', async () => {
  const calls = stubApi(204)
  renderDanger()
  const dialog = await openDialog()

  await userEvent.type(within(dialog).getByLabelText('Пароль'), 'correct-password')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Удалить навсегда' }))

  expect(await screen.findByText('Аккаунт удалён')).toBeInTheDocument()
  await waitFor(() => {
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true })
  })
  expect(calls).toEqual([
    { method: 'DELETE', path: '/api/v1/users/me', body: { password: 'correct-password' } },
  ])
})

it('lets a guest confirm with the session alone, without a password', async () => {
  const calls = stubApi(204)
  renderDanger(guest)
  const dialog = await openDialog()

  expect(within(dialog).queryByLabelText('Пароль')).not.toBeInTheDocument()
  const confirm = within(dialog).getByRole('button', { name: 'Удалить навсегда' })
  expect(confirm).toBeDisabled()

  await userEvent.click(within(dialog).getByLabelText('Я понимаю, что аккаунт удалится навсегда'))
  await userEvent.click(confirm)

  await waitFor(() => {
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true })
  })
  expect(calls).toEqual([{ method: 'DELETE', path: '/api/v1/users/me', body: null }])
})
