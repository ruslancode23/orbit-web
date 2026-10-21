import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { getCurrentUserQueryKey, type SelfProfile } from '@/shared/api'
import { renderWithProviders } from '@/shared/lib/test'

import { AccountSettings } from './AccountSettings'

const me: SelfProfile = {
  id: 'u-me',
  nickname: 'anna',
  displayName: 'Анна',
  accentColor: 'violet',
  bio: '',
  isGuest: false,
  email: 'anna@example.com',
  createdAt: new Date('2026-10-18T10:00:00Z'),
}

const guest: SelfProfile = {
  ...me,
  nickname: 'Гость',
  isGuest: true,
  email: null,
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

interface Answer {
  status?: number
  body: unknown
  headers?: Record<string, string>
}

interface Call {
  method: string
  path: string
  body?: unknown
}

const stubApi = (answer: (path: string) => Answer) => {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      calls.push({
        method: request.method,
        path: url.pathname,
        body: request.method === 'PATCH' ? await request.clone().json() : undefined,
      })
      const next = answer(url.pathname)
      return json(next.body, next.status ?? 200, next.headers ?? {})
    }),
  )
  return calls
}

const renderAccount = (profile: SelfProfile = me) =>
  renderWithProviders(
    <AccountSettings
      profile={profile}
      claimGuest={<button type="button">Создать аккаунт</button>}
    />,
    { route: '/me' },
  )

const formNamed = (name: string) => screen.getByRole('form', { name })

afterEach(() => {
  vi.unstubAllGlobals()
})

it('shows a guest the way to a full account instead of forms that would answer 403', () => {
  stubApi(() => ({ body: {} }))
  renderAccount(guest)

  expect(screen.getByText(/Вы вошли как гость/)).toBeInTheDocument()
  expect(screen.getByText(/ник и почту изменить нельзя/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Создать аккаунт' })).toBeInTheDocument()
  expect(screen.queryByRole('form', { name: 'Смена ника' })).not.toBeInTheDocument()
  expect(screen.queryByRole('form', { name: 'Смена почты' })).not.toBeInTheDocument()
  expect(screen.queryByRole('form', { name: 'Смена пароля' })).not.toBeInTheDocument()
})

it('points a taken nickname at its field and keeps the session', async () => {
  const calls = stubApi(() => ({
    status: 409,
    body: { error: { code: 'conflict', message: 'this nickname is taken' } },
  }))
  renderAccount()
  const form = formNamed('Смена ника')

  await userEvent.clear(within(form).getByLabelText('Новый ник'))
  await userEvent.type(within(form).getByLabelText('Новый ник'), 'new-anna')
  await userEvent.type(within(form).getByLabelText('Текущий пароль'), 'old-password')
  await userEvent.click(within(form).getByRole('button', { name: 'Сменить ник' }))

  const alert = await within(form).findByRole('alert')
  expect(alert).toHaveTextContent('Этот ник занят')
  expect(within(form).getByLabelText('Новый ник')).toHaveAttribute('aria-invalid', 'true')
  const describedBy =
    within(form).getByLabelText('Новый ник').getAttribute('aria-describedby') ?? ''
  expect(describedBy.split(' ')).toContain(alert.id)
  expect(calls.some((call) => call.path === '/api/v1/users/me/nickname')).toBe(true)
})

it('says a wrong current password belongs to the password field', async () => {
  stubApi(() => ({
    status: 401,
    body: { error: { code: 'unauthorized', message: 'wrong password' } },
  }))
  renderAccount()
  const form = formNamed('Смена ника')

  await userEvent.clear(within(form).getByLabelText('Новый ник'))
  await userEvent.type(within(form).getByLabelText('Новый ник'), 'new-anna')
  await userEvent.type(within(form).getByLabelText('Текущий пароль'), 'wrong-password')
  await userEvent.click(within(form).getByRole('button', { name: 'Сменить ник' }))

  expect(await within(form).findByText('Неверный текущий пароль.')).toBeInTheDocument()
  expect(within(form).getByLabelText('Текущий пароль')).toHaveAttribute('aria-invalid', 'true')
})

it('shows a malformed email under the email field', async () => {
  stubApi(() => ({
    status: 400,
    body: { error: { code: 'invalid_request', message: 'invalid email address' } },
  }))
  renderAccount()
  const form = formNamed('Смена почты')

  await userEvent.clear(within(form).getByLabelText('Новая почта'))
  await userEvent.type(within(form).getByLabelText('Новая почта'), 'taken@example.com')
  await userEvent.type(within(form).getByLabelText('Текущий пароль'), 'old-password')
  await userEvent.click(within(form).getByRole('button', { name: 'Сменить почту' }))

  expect(await within(form).findByRole('alert')).toHaveTextContent('Проверьте адрес почты')
})

it('speaks the Retry-After wait of a rate limit', async () => {
  stubApi(() => ({
    status: 429,
    headers: { 'Retry-After': '30' },
    body: { error: { code: 'too_many_requests', message: 'too many nickname changes' } },
  }))
  renderAccount()
  const form = formNamed('Смена ника')

  await userEvent.clear(within(form).getByLabelText('Новый ник'))
  await userEvent.type(within(form).getByLabelText('Новый ник'), 'new-anna')
  await userEvent.type(within(form).getByLabelText('Текущий пароль'), 'old-password')
  await userEvent.click(within(form).getByRole('button', { name: 'Сменить ник' }))

  expect(await within(form).findByRole('alert')).toHaveTextContent(
    'Попробуйте снова через 30 секунд',
  )
})

it('replaces the session after a nickname change and clears the password', async () => {
  const changed = { ...me, nickname: 'new-anna' }
  stubApi((path) => {
    if (path === '/api/v1/users/me/nickname') {
      return { body: changed }
    }
    return { body: me }
  })
  const { queryClient } = renderAccount()
  const form = formNamed('Смена ника')

  await userEvent.clear(within(form).getByLabelText('Новый ник'))
  await userEvent.type(within(form).getByLabelText('Новый ник'), 'new-anna')
  await userEvent.type(within(form).getByLabelText('Текущий пароль'), 'old-password')
  await userEvent.click(within(form).getByRole('button', { name: 'Сменить ник' }))

  expect(await screen.findByText('Ник изменён')).toBeInTheDocument()
  expect(queryClient.getQueryData(getCurrentUserQueryKey())).toMatchObject({
    nickname: 'new-anna',
  })
  await waitFor(() => {
    expect(within(form).getByLabelText('Текущий пароль')).toHaveValue('')
  })
})

it('links a server error to the password field of the password form', async () => {
  stubApi(() => ({
    status: 401,
    body: { error: { code: 'unauthorized', message: 'wrong password' } },
  }))
  renderAccount()
  const form = formNamed('Смена пароля')

  await userEvent.type(within(form).getByLabelText('Текущий пароль'), 'wrong-password')
  await userEvent.type(within(form).getByLabelText('Новый пароль'), 'a-new-long-password')
  await userEvent.type(within(form).getByLabelText('Повторите новый пароль'), 'a-new-long-password')
  await userEvent.click(within(form).getByRole('button', { name: 'Сменить пароль' }))

  await waitFor(() => {
    expect(within(form).getByText('Неверный текущий пароль.')).toBeInTheDocument()
  })
})
