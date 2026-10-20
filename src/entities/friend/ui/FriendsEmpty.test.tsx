import { render, screen } from '@testing-library/react'

import { UsersIcon } from '@/shared/ui/icon'

import { FriendsEmpty } from './FriendsEmpty'

it('says why the list is empty and announces it', () => {
  render(
    <FriendsEmpty
      icon={<UsersIcon />}
      title="Сейчас никого нет в сети"
      description="Когда друзья зайдут, они появятся здесь."
    />,
  )

  expect(screen.getByRole('status')).toHaveTextContent('Сейчас никого нет в сети')
  expect(screen.getByRole('status')).toHaveTextContent('Когда друзья зайдут, они появятся здесь.')
})
