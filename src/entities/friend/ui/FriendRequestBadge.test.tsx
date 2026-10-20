import { render, screen } from '@testing-library/react'

import { FriendRequestBadge } from './FriendRequestBadge'

it('shows the number of incoming requests', () => {
  render(<FriendRequestBadge count={3} />)

  expect(screen.getByText('3')).toBeInTheDocument()
})

it('caps the number so the small mark stays readable', () => {
  render(<FriendRequestBadge count={12} />)

  expect(screen.getByText('9+')).toBeInTheDocument()
})

it('draws nothing when no request is waiting', () => {
  const { container } = render(<FriendRequestBadge count={0} />)

  expect(container).toBeEmptyDOMElement()
})
