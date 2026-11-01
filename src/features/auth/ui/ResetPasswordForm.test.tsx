import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/shared/lib/test'

import { ResetPasswordForm } from './ResetPasswordForm'

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
        body: request.method === 'POST' ? await request.clone().json() : undefined,
      })
      if (status === 204) {
        return new Response(null, { status })
      }
      return json(body, status)
    }),
  )
  return calls
}

const fill = async (password = 'a-new-long-password', confirm = password) => {
  await userEvent.type(screen.getByLabelText(/^Новый пароль$/, { selector: 'input' }), password)
  await userEvent.type(screen.getByLabelText('Повторите новый пароль'), confirm)
  await userEvent.click(screen.getByRole('button', { name: 'Сменить пароль' }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('will not send two passwords that do not match', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  renderWithProviders(<ResetPasswordForm token="tok" />, { route: '/reset?token=tok' })

  await fill('a-new-long-password', 'another-long-password')

  expect(await screen.findByText('Пароли не совпадают.')).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

it('explains a used, expired or unknown token without guessing which', async () => {
  stubApi(400, { error: { code: 'invalid_request', message: 'invalid reset token' } })
  renderWithProviders(<ResetPasswordForm token="tok" />, { route: '/reset?token=tok' })

  await fill()

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Ссылка недействительна, просрочена или уже использована. Запросите новую.',
  )
})

it('sends the token and the new password, then sends the reader to sign in', async () => {
  const calls = stubApi(204)
  renderWithProviders(<ResetPasswordForm token="tok" />, { route: '/reset?token=tok' })

  await fill('a-new-long-password', 'a-new-long-password')

  expect(await screen.findByRole('heading', { name: 'Пароль изменён' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login')
  expect(calls).toEqual([
    {
      method: 'POST',
      path: '/api/v1/auth/password/reset',
      body: { token: 'tok', password: 'a-new-long-password' },
    },
  ])
})

it('says the link has no token instead of showing a form that can only fail', () => {
  renderWithProviders(<ResetPasswordForm token={null} />, { route: '/reset' })

  expect(screen.getByRole('heading', { name: 'В ссылке нет токена' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Запросить новую ссылку' })).toHaveAttribute(
    'href',
    '/forgot-password',
  )
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
})
