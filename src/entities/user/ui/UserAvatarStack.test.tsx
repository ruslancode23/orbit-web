import { render, screen } from '@testing-library/react'

import { UserAvatarStack } from './UserAvatarStack'

const anna = {
  id: 'u-anna',
  nickname: 'Anna',
  displayName: 'Анна',
  accentColor: 'slate' as const,
}
const bob = {
  id: 'u-bob',
  nickname: 'Bob',
  displayName: 'Боб',
  accentColor: 'violet' as const,
}
const carol = {
  id: 'u-carol',
  nickname: 'Carol',
  displayName: 'Кэрол',
  accentColor: 'teal' as const,
}

it('stacks the first two people of a group', () => {
  const { container } = render(<UserAvatarStack profiles={[anna, bob, carol]} />)

  expect(screen.getByText('А')).toBeInTheDocument()
  expect(screen.getByText('Б')).toBeInTheDocument()
  expect(screen.queryByText('К')).not.toBeInTheDocument()
  // The names beside the picture say who the group is; the circles are decoration.
  expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2)
  expect(screen.queryAllByRole('img')).toHaveLength(0)
})

it('draws nothing when there is nobody to show', () => {
  const { container } = render(<UserAvatarStack profiles={[]} />)

  expect(container).toBeEmptyDOMElement()
})
