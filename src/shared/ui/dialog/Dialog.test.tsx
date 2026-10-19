import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './Dialog'

const renderDialog = () =>
  render(
    <Dialog>
      <DialogTrigger>Открыть</DialogTrigger>
      <DialogContent>
        <DialogTitle>Настройки</DialogTitle>
        <DialogDescription>Что-нибудь поменять.</DialogDescription>
        <input aria-label="Имя" />
        <DialogClose>Закрыть</DialogClose>
      </DialogContent>
    </Dialog>,
  )

describe('Dialog', () => {
  it('opens as a named modal, focuses its first field and keeps focus inside', async () => {
    renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Открыть' }))

    const dialog = screen.getByRole('dialog', { name: 'Настройки' })
    expect(dialog).toHaveAccessibleDescription('Что-нибудь поменять.')
    expect(screen.getByRole('textbox', { name: 'Имя' })).toHaveFocus()

    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Закрыть' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('textbox', { name: 'Имя' })).toHaveFocus()
  })

  it('closes on Esc and gives focus back to the trigger', async () => {
    renderDialog()
    const trigger = screen.getByRole('button', { name: 'Открыть' })

    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
