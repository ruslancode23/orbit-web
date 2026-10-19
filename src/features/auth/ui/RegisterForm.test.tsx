import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { getCurrentUserQueryKey } from '@/shared/api'
import { renderWithProviders } from '@/shared/lib/test'

import { RegisterForm } from './RegisterForm'

import type * as ReactRouterModule from 'react-router'

type ReactRouter = typeof ReactRouterModule

const navigate = vi.fn()
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<ReactRouter>()),
  useNavigate: () => navigate,
}))

const anna = {
  id: '6f1c0a9e-6b1a-4a3a-8f0e-2a4f1d2b3c4d',
  nickname: 'Аня',
  isGuest: false,
  createdAt: '2026-10-18T10:00:00Z',
}

const answerWith = (status: number, body: unknown) => {
  const fetchMock = vi.fn((_input?: unknown) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  navigate.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** What the client actually sent: the generated SDK calls fetch with a Request. */
const sentBody = async (fetchMock: ReturnType<typeof answerWith>): Promise<unknown> => {
  const request = fetchMock.mock.calls[0]?.[0] as Request | undefined
  if (!request) {
    throw new Error('fetch was not called')
  }
  return request.clone().json()
}

const fill = async (nickname: string, password: string, email = '') => {
  await userEvent.type(screen.getByLabelText('Ник'), nickname)
  if (email) {
    await userEvent.type(screen.getByLabelText('Email (необязательно)'), email)
  }
  await userEvent.type(screen.getByLabelText('Пароль'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }))
}

it('creates the account and remembers it', async () => {
  const fetchMock = answerWith(201, anna)
  const { queryClient } = renderWithProviders(<RegisterForm />, { route: '/register' })

  await fill('Аня', 'correct horse battery', 'anya@example.com')

  await waitFor(() => {
    expect(queryClient.getQueryData(getCurrentUserQueryKey())).toMatchObject({ nickname: 'Аня' })
  })
  expect(navigate).toHaveBeenCalledWith('/', { replace: true })

  expect(await sentBody(fetchMock)).toMatchObject({ nickname: 'Аня', email: 'anya@example.com' })
})

// An email nobody typed must not be sent as an empty string: the server would refuse it.
it('leaves the email out when it is empty', async () => {
  const fetchMock = answerWith(201, anna)
  renderWithProviders(<RegisterForm />, { route: '/register' })

  await fill('Аня', 'correct horse battery')

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalled()
  })
  expect(await sentBody(fetchMock)).not.toHaveProperty('email')
})

it('says a short password is short before asking the server', async () => {
  const fetchMock = answerWith(201, anna)
  renderWithProviders(<RegisterForm />, { route: '/register' })

  await fill('Аня', 'короткий')

  expect(await screen.findByRole('alert')).toHaveTextContent('не короче 10 символов')
  expect(fetchMock).not.toHaveBeenCalled()
})

it('explains a taken nickname', async () => {
  answerWith(409, { error: { code: 'conflict', message: 'taken' } })
  renderWithProviders(<RegisterForm />, { route: '/register' })

  await fill('Аня', 'correct horse battery')

  expect(await screen.findByRole('alert')).toHaveTextContent('уже заняты')
  expect(navigate).not.toHaveBeenCalled()
})
