import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/shared/lib/test'

import { ForgotPasswordForm } from './ForgotPasswordForm'

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

interface Call {
  method: string
  path: string
  body?: unknown
}

const stubApi = (status: number, body: unknown = null, headers: Record<string, string> = {}) => {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      calls.push({
        method: request.method,
        path: url.pathname,
        body: request.method === 'POST' ? await request.clone().json() : undefined,
      })
      if (status === 204) {
        return new Response(null, { status })
      }
      return json(body, status, headers)
    }),
  )
  return calls
}

const send = async (login = 'anna@example.com') => {
  await userEvent.type(screen.getByLabelText('Ник или почта'), login)
  await userEvent.click(screen.getByRole('button', { name: 'Отправить ссылку' }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('always answers neutrally and never says whether the account exists', async () => {
  const calls = stubApi(204)
  renderWithProviders(<ForgotPasswordForm />, { route: '/forgot-password' })

  await send()

  expect(await screen.findByText(/Если аккаунт существует, письмо отправлено/)).toBeInTheDocument()
  expect(screen.queryByText(/не существует|не найден|аккаунта нет/i)).not.toBeInTheDocument()
  expect(calls).toEqual([
    {
      method: 'POST',
      path: '/api/v1/auth/password/reset-request',
      body: { login: 'anna@example.com' },
    },
  ])
})

it('speaks the Retry-After wait when requests ran out', async () => {
  stubApi(
    429,
    { error: { code: 'too_many_requests', message: 'too many reset requests' } },
    {
      'Retry-After': '360',
    },
  )
  renderWithProviders(<ForgotPasswordForm />, { route: '/forgot-password' })

  await send()

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Слишком много запросов на восстановление. Попробуйте снова через 6 мин.',
  )
  expect(screen.queryByText(/Если аккаунт существует/)).not.toBeInTheDocument()
})
