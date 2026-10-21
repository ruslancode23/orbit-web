import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/shared/lib/test'

import { ClaimGuest } from './ClaimGuest'

const guest = {
  id: 'u-guest',
  nickname: 'Гость',
  isGuest: true,
  createdAt: '2026-10-20T10:00:00Z',
}
const fullAccount = {
  id: guest.id,
  nickname: 'Гость',
  isGuest: false,
  createdAt: '2026-10-20T10:00:00Z',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const stubApi = (claimStatus = 200) => {
  const claims: string[] = []
  let claimed = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      if (url.pathname.endsWith('/auth/me')) {
        return json(claimed ? fullAccount : guest)
      }
      if (url.pathname.endsWith('/auth/claim')) {
        claims.push(await request.clone().text())
        if (claimStatus === 200) {
          claimed = true
          return json(fullAccount)
        }
        return json({ error: { code: 'conflict', message: 'taken' } }, claimStatus)
      }
      return json({})
    }),
  )
  return claims
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('turns the guest into an account without losing the nickname', async () => {
  const claims = stubApi()
  renderWithProviders(<ClaimGuest />, { route: '/' })

  await userEvent.click(await screen.findByRole('button', { name: 'Создать аккаунт' }))
  await userEvent.type(screen.getByLabelText('Пароль'), 'a-long-enough-password')
  await userEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }))

  await waitFor(() => {
    expect(screen.queryByText('Вы вошли как гость.')).not.toBeInTheDocument()
  })
  expect(claims[0]).toContain('"nickname":"Гость"')
  expect(claims[0]).toContain('"password":"a-long-enough-password"')
})

it('explains a taken nickname or email', async () => {
  stubApi(409)
  renderWithProviders(<ClaimGuest />, { route: '/' })

  await userEvent.click(await screen.findByRole('button', { name: 'Создать аккаунт' }))
  await userEvent.type(screen.getByLabelText('Пароль'), 'a-long-enough-password')
  await userEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('уже заняты')
})

it('is not shown to a full account', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => json(fullAccount)),
  )
  renderWithProviders(<ClaimGuest />, { route: '/' })

  await waitFor(() => {
    expect(screen.queryByText('Вы вошли как гость.')).not.toBeInTheDocument()
  })
})
