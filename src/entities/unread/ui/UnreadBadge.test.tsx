import { render, screen } from '@testing-library/react'

import { UnreadBadge } from './UnreadBadge'

it('prints the number in the compact badge when asked', () => {
  render(<UnreadBadge unread={3} mentions={0} compact count />)

  expect(screen.getByText('3')).toBeInTheDocument()
})

it('keeps the compact badge a dot by default', () => {
  const { container } = render(<UnreadBadge unread={3} mentions={0} compact />)

  expect(screen.queryByText('3')).not.toBeInTheDocument()
  expect(container.querySelector('.size-2')).not.toBeNull()
})

it('marks mentions apart and draws nothing at zero', () => {
  const { rerender } = render(<UnreadBadge unread={2} mentions={1} compact count />)
  expect(screen.getByText('@1')).toBeInTheDocument()

  rerender(<UnreadBadge unread={0} mentions={0} compact count />)
  expect(screen.queryByText('@1')).not.toBeInTheDocument()
})
