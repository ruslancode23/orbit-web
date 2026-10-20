import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { IconButton } from './IconButton'

describe('IconButton', () => {
  it('is known by its label, not by the picture', () => {
    render(
      <IconButton label="Прикрепить файл">
        <span>иконка</span>
      </IconButton>,
    )

    expect(screen.getByRole('button', { name: 'Прикрепить файл' })).toBeInTheDocument()
  })

  it('shows its hint on keyboard focus', async () => {
    render(<IconButton label="Изменить сообщение" tooltip="Изменить" />)

    await userEvent.tab()

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Изменить')
  })

  it('reads a toggle out through aria-pressed and keeps its name', async () => {
    const onPressedChange = vi.fn()
    render(<IconButton label="Выключить микрофон" pressed={false} onClick={onPressedChange} />)

    const button = screen.getByRole('button', { name: 'Выключить микрофон', pressed: false })
    await userEvent.click(button)

    expect(onPressedChange).toHaveBeenCalledOnce()
  })

  it('marks a pressed toggle for assistive technology', () => {
    render(<IconButton label="Показывать экран" pressed />)

    expect(screen.getByRole('button', { name: 'Показывать экран' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('stays out of the tab order when disabled', () => {
    render(<IconButton label="Отключиться" disabled />)

    expect(screen.getByRole('button', { name: 'Отключиться' })).toBeDisabled()
  })
})
