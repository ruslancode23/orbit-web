import { render, screen } from '@testing-library/react'

import type { UserProfile } from '@/shared/api'

import { UserName } from './UserName'

const anna: UserProfile = {
  id: 'u-anna',
  nickname: 'anna',
  displayName: 'Анна',
  accentColor: 'slate',
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-10-18T10:00:00Z'),
}

it('shows the display name and the unique handle beside it', () => {
  render(<UserName profile={anna} />)

  expect(screen.getByText('Анна')).toBeInTheDocument()
  expect(screen.getByText('@anna')).toBeInTheDocument()
})

it('does not print the handle twice when it is already the display name', () => {
  render(<UserName profile={{ ...anna, displayName: 'anna' }} />)

  expect(screen.getByText('anna')).toBeInTheDocument()
  expect(screen.queryByText('@anna')).not.toBeInTheDocument()
})

it('can show the handle on request and hide it again', () => {
  const { rerender } = render(<UserName profile={{ ...anna, displayName: 'anna' }} showNickname />)
  expect(screen.getByText('@anna')).toBeInTheDocument()

  rerender(<UserName profile={anna} showNickname={false} />)
  expect(screen.queryByText('@anna')).not.toBeInTheDocument()
})

it('falls back to the nickname when no display name is set', () => {
  render(<UserName profile={{ ...anna, displayName: '' }} />)

  expect(screen.getByText('anna')).toBeInTheDocument()
})
