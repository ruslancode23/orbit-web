import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MessageText } from './MessageText'

it('renders formatting as elements, never as HTML', () => {
  const { container } = render(
    <MessageText content={'**жирный** *курсив* ~~нет~~ `код` и <script>alert(1)</script>'} />,
  )
  expect(screen.getByText('жирный').tagName).toBe('STRONG')
  expect(screen.getByText('курсив').tagName).toBe('EM')
  expect(screen.getByText('нет').tagName).toBe('S')
  expect(screen.getByText('код').tagName).toBe('CODE')
  expect(container.querySelector('script')).toBeNull()
})

it('opens a link in a new tab without a reference back', () => {
  render(<MessageText content="https://orbit.chat/docs" />)
  const link = screen.getByRole('link', { name: 'https://orbit.chat/docs' })
  expect(link).toHaveAttribute('href', 'https://orbit.chat/docs')
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')
})

it('keeps a spoiler covered until it is asked for', async () => {
  render(<MessageText content="там ||секрет||" />)
  expect(screen.queryByText('секрет')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Показать спойлер' }))
  expect(screen.getByText('секрет')).toBeInTheDocument()
})

it('marks the reader mention inside formatting', () => {
  render(<MessageText content="**@Anna** привет" mention="Anna" />)
  expect(screen.getByText('@Anna').tagName).toBe('MARK')
})
