import { screen } from '@testing-library/react'

import { renderWithProviders } from '@/shared/lib/test'

import AboutBetaPage from './AboutBetaPage'

// Someone deciding whether to join reads what is missing and what is kept,
// and finds where to write — without an account.
it('says what is missing, what is kept and where to write', () => {
  renderWithProviders(<AboutBetaPage />, { route: '/beta' })

  expect(screen.getByRole('heading', { name: 'Orbit — закрытая бета', level: 1 })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Чего пока нет' })).toBeVisible()
  expect(screen.getByText(/Восстановления пароля/)).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Какие данные мы храним' })).toBeVisible()
  expect(screen.getByText(/только в виде хэша/)).toBeVisible()
  // .env.test sets no feedback link: the page points to whoever invited them.
  expect(screen.getByText(/Расскажите тому, кто пригласил вас/)).toBeVisible()
  expect(screen.getByRole('link', { name: 'Вернуться в Orbit' })).toHaveAttribute('href', '/')
})
