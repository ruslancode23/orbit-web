import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Toggle } from './Toggle'

describe('Toggle', () => {
  it('reports the next state when pressed with the keyboard', async () => {
    const onPressedChange = vi.fn()
    render(
      <Toggle pressed={false} onPressedChange={onPressedChange}>
        Выключить микрофон
      </Toggle>,
    )
    const toggle = screen.getByRole('button', { name: 'Выключить микрофон' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await userEvent.tab()
    await userEvent.keyboard(' ')

    expect(toggle).toHaveFocus()
    expect(onPressedChange).toHaveBeenCalledWith(true)
  })
})
