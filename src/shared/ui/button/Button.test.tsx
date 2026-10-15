import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Button } from './Button'

describe('Button', () => {
  it('calls onClick when pressed', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Войти</Button>)

    await userEvent.click(screen.getByRole('button', { name: 'Войти' }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders the child element with asChild', () => {
    render(
      <Button asChild>
        <a href="/invite">Пригласить</a>
      </Button>,
    )

    expect(screen.getByRole('link', { name: 'Пригласить' })).toHaveAttribute('href', '/invite')
  })
})
