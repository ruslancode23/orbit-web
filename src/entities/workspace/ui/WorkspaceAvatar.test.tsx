import { fireEvent, render, screen } from '@testing-library/react'

import { WorkspaceAvatar } from './WorkspaceAvatar'

const iconUrl = 'https://files.test/icon.webp?signature=1'

it('shows the initials, named after the server, when there is no icon', () => {
  render(<WorkspaceAvatar name="Команда Orbit" iconUrl={null} />)

  expect(screen.getByRole('img', { name: 'Команда Orbit' })).toHaveTextContent('КO')
})

it('shows the icon when there is one', () => {
  const { container } = render(<WorkspaceAvatar name="Команда Orbit" iconUrl={iconUrl} />)

  expect(container.querySelector('img')).toHaveAttribute('src', iconUrl)
  expect(screen.getByRole('img', { name: 'Команда Orbit' })).not.toHaveTextContent('КO')
})

// Signed links expire: a link that no longer loads falls back to the initials,
// and the fresh link of the next answer gets its chance again.
it('falls back to the initials when the link breaks, and tries a new link', () => {
  const { container, rerender } = render(<WorkspaceAvatar name="Команда" iconUrl={iconUrl} />)

  const image = container.querySelector('img')
  expect(image).not.toBeNull()
  if (image) fireEvent.error(image)

  expect(container.querySelector('img')).toBeNull()
  expect(screen.getByRole('img', { name: 'Команда' })).toHaveTextContent('КО')

  rerender(<WorkspaceAvatar name="Команда" iconUrl={`${iconUrl}2`} />)
  expect(container.querySelector('img')).toHaveAttribute('src', `${iconUrl}2`)
})

it('stays out of the accessibility tree when the control around it names the server', () => {
  render(
    <a href="/s/1" aria-label="Команда">
      <WorkspaceAvatar name="Команда" decorative />
    </a>,
  )

  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Команда' })).toBeInTheDocument()
})

it('marks the open server over an unread one, and shows the badge', () => {
  const { container, rerender } = render(<WorkspaceAvatar name="Команда" unread />)
  expect(container.querySelector('[data-indicator]')).toHaveAttribute('data-indicator', 'unread')

  rerender(<WorkspaceAvatar name="Команда" unread active badge={<span>@2</span>} />)
  expect(container.querySelector('[data-indicator]')).toHaveAttribute('data-indicator', 'active')
  expect(screen.getByText('@2')).toBeInTheDocument()

  rerender(<WorkspaceAvatar name="Команда" />)
  expect(container.querySelector('[data-indicator]')).toBeNull()
})
