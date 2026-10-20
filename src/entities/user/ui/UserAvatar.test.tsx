import { fireEvent, render, screen } from '@testing-library/react'

import type { UserProfile } from '@/shared/api'

import { UserAvatar } from './UserAvatar'

const avatarUrl = 'https://files.test/anna.webp?signature=1'

const anna: UserProfile = {
  id: 'u-anna',
  nickname: 'anna',
  displayName: 'Анна',
  accentColor: 'violet',
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-10-18T10:00:00Z'),
}

it('shows the picture when the profile has one', () => {
  render(<UserAvatar profile={{ ...anna, avatarUrl }} />)

  const image = screen.getByRole('img', { name: 'Анна' })
  expect(image.tagName).toBe('IMG')
  expect(image).toHaveAttribute('src', avatarUrl)
  expect(image).toHaveAttribute('width', '32')
  expect(image).toHaveAttribute('height', '32')
  expect(image).toHaveAttribute('loading', 'lazy')
  expect(image).toHaveAttribute('decoding', 'async')
})

// A signed link can be gone: the initials must take over without a broken icon.
it('falls back to the initials on the accent colour when the picture fails', () => {
  const { rerender } = render(<UserAvatar profile={{ ...anna, avatarUrl }} />)

  fireEvent.error(screen.getByRole('img', { name: 'Анна' }))

  const fallback = screen.getByRole('img', { name: 'Анна' })
  expect(fallback.tagName).toBe('SPAN')
  expect(fallback).toHaveTextContent('А')
  expect(fallback).toHaveClass('bg-profile-violet')

  // A fresh link after the next answer gets its chance again.
  rerender(<UserAvatar profile={{ ...anna, avatarUrl: `${avatarUrl}2` }} />)
  expect(screen.getByRole('img', { name: 'Анна' }).tagName).toBe('IMG')
})

it('draws the initials on the accent colour when there is no picture', () => {
  render(<UserAvatar profile={anna} />)

  const initials = screen.getByRole('img', { name: 'Анна' })
  expect(initials).toHaveTextContent('А')
  expect(initials).toHaveClass('bg-profile-violet')
})

it('names the avatar after the handle when there is no display name', () => {
  render(<UserAvatar profile={{ ...anna, displayName: '' }} />)

  expect(screen.getByRole('img', { name: '@anna' })).toHaveTextContent('A')
})

it.each([
  ['online', 'В сети'],
  ['idle', 'Отошёл'],
  ['dnd', 'Не беспокоить'],
  ['offline', 'Не в сети'],
] as const)('shows the %s status as a labelled dot', (status, label) => {
  const { rerender } = render(<UserAvatar profile={anna} status={status} />)

  expect(screen.getByLabelText(label)).toHaveAttribute('title', label)

  rerender(<UserAvatar profile={anna} />)
  expect(screen.queryByLabelText(label)).not.toBeInTheDocument()
})
