import { screen } from '@testing-library/react'

import type { Friend, UserProfile } from '@/shared/api'
import { renderWithProviders } from '@/shared/lib/test'

import FriendRow from './FriendRow'

const friend: Friend = {
  id: 'u-bob',
  nickname: 'bob',
  presence: 'dnd',
  since: new Date('2026-10-20T10:00:00Z'),
}

const profile: UserProfile = {
  id: friend.id,
  nickname: friend.nickname,
  displayName: 'Боб',
  accentColor: 'teal',
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-09-02T10:00:00Z'),
}

it('draws the presence dot the server sent for a friend', () => {
  renderWithProviders(
    <FriendRow
      friend={friend}
      profile={profile}
      onRemove={() => undefined}
      onBlock={() => undefined}
      pending={false}
    />,
    { route: '/me' },
  )

  expect(screen.getByText('Боб')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Не беспокоить' })).toBeInTheDocument()
})
