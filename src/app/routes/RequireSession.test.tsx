import { screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

import { renderWithProviders } from '@/shared/lib/test'

import { RequireSession } from './RequireSession'

const anna = {
  id: '6f1c0a9e-6b1a-4a3a-8f0e-2a4f1d2b3c4d',
  nickname: 'Anna',
  isGuest: false,
  createdAt: new Date('2026-10-18T10:00:00Z'),
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

afterEach(() => {
  vi.unstubAllGlobals()
})

function guarded() {
  return (
    <MemoryRouter initialEntries={['/secret']}>
      <Routes>
        <Route element={<RequireSession />}>
          <Route path="/secret" element={<p>тайная страница</p>} />
        </Route>
        <Route path="/login" element={<p>страница входа</p>} />
      </Routes>
    </MemoryRouter>
  )
}

it('waits for the answer instead of throwing people out', () => {
  answerWith(200, anna)
  renderWithProviders(guarded())

  expect(screen.getByRole('status')).toBeInTheDocument()
  expect(screen.queryByText('страница входа')).not.toBeInTheDocument()
})

it('shows the page to someone with a session', async () => {
  answerWith(200, anna)
  renderWithProviders(guarded())

  expect(await screen.findByText('тайная страница')).toBeInTheDocument()
})

it('sends someone without a session to sign in', async () => {
  answerWith(401, { error: { code: 'unauthorized', message: 'sign in first' } })
  renderWithProviders(guarded())

  expect(await screen.findByText('страница входа')).toBeInTheDocument()
})
