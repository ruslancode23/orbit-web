import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { getCurrentUserQueryKey } from '@/shared/api'
import { renderWithProviders } from '@/shared/lib/test'

import { LoginForm } from './LoginForm'

import type * as ReactRouterModule from 'react-router'

type ReactRouter = typeof ReactRouterModule

const navigate = vi.fn()
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<ReactRouter>()),
  useNavigate: () => navigate,
}))

const anna = {
  id: '6f1c0a9e-6b1a-4a3a-8f0e-2a4f1d2b3c4d',
  nickname: 'Anna',
  isGuest: false,
  createdAt: '2026-10-18T10:00:00Z',
}

function answerWith(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ),
  )
}

beforeEach(() => {
  navigate.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function signIn(login = 'Anna', password = 'correct horse battery') {
  await userEvent.type(screen.getByLabelText('Ник или email'), login)
  await userEvent.type(screen.getByLabelText('Пароль'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Войти' }))
}

it('signs in, remembers the account and leaves the form', async () => {
  answerWith(200, anna)
  const { queryClient } = renderWithProviders(<LoginForm />, { route: '/login' })

  await signIn()

  // The client turns dates into Date objects, so compare what identifies the account.
  await waitFor(() => {
    expect(queryClient.getQueryData(getCurrentUserQueryKey())).toMatchObject({
      id: anna.id,
      nickname: anna.nickname,
    })
  })
  expect(navigate).toHaveBeenCalledWith('/', { replace: true })
})

it('says the login or the password is wrong, without saying which', async () => {
  answerWith(401, { error: { code: 'unauthorized', message: 'wrong login or password' } })
  renderWithProviders(<LoginForm />, { route: '/login' })

  await signIn('Anna', 'not my password')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Неверный логин или пароль.')
  expect(navigate).not.toHaveBeenCalled()
})

it('tells a network failure apart from a refusal', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
  )
  renderWithProviders(<LoginForm />, { route: '/login' })

  await signIn()

  expect(await screen.findByRole('alert')).toHaveTextContent('Нет соединения с сервером.')
})

it('does not send an empty form', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  renderWithProviders(<LoginForm />, { route: '/login' })

  await userEvent.click(screen.getByRole('button', { name: 'Войти' }))

  expect(fetchMock).not.toHaveBeenCalled()
})
