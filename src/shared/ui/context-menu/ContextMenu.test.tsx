import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from './ContextMenu'

const renderMenu = (onSelect = vi.fn()) => {
  render(
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>Строка</div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onSelect}>Ответить</ContextMenuItem>
        <ContextMenuItem danger>Удалить</ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Реакция</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem>👍</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>,
  )
  return onSelect
}

describe('ContextMenu', () => {
  it('opens on a right click and runs the chosen item', async () => {
    const onSelect = renderMenu()

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    fireEvent.contextMenu(screen.getByText('Строка'))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Ответить' }))

    expect(onSelect).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    renderMenu()
    fireEvent.contextMenu(screen.getByText('Строка'))

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens a submenu from its item', async () => {
    renderMenu()
    fireEvent.contextMenu(screen.getByText('Строка'))

    await userEvent.click(screen.getByRole('menuitem', { name: /Реакция/ }))

    expect(await screen.findByRole('menuitem', { name: '👍' })).toBeInTheDocument()
  })
})
