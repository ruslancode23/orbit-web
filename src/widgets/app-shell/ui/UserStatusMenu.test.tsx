import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LiveProvider, setPresenceChoice, useMyStatus } from '@/entities/live'
import { renderWithProviders } from '@/shared/lib/test'

import { UserStatusMenu } from './UserStatusMenu'

class FakeSocket {
  static readonly OPEN = 1
  readyState = 0
  readonly sent: string[] = []
  private listeners = new Map<string, ((event: unknown) => void)[]>()

  constructor() {
    sockets.push(this)
  }

  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  send(frame: string) {
    this.sent.push(frame)
  }

  close() {
    return undefined
  }

  accept() {
    this.readyState = FakeSocket.OPEN
    for (const listener of this.listeners.get('open') ?? []) {
      listener(new Event('open'))
    }
  }
}

const sockets: FakeSocket[] = []

const StatusProbe = () => {
  const { status, choose } = useMyStatus()
  return (
    <UserStatusMenu
      status={status}
      onStatusChange={choose}
      onEditProfile={() => undefined}
      onSetStatus={() => undefined}
    >
      <span>Анна</span>
    </UserStatusMenu>
  )
}

const renderMenu = () => {
  vi.stubGlobal('WebSocket', FakeSocket)
  renderWithProviders(
    <LiveProvider enabled>
      <StatusProbe />
    </LiveProvider>,
  )
  const socket = sockets[0]
  act(() => {
    socket?.accept()
  })
  return socket
}

const trigger = () => screen.getByRole('button', { name: /Анна/ })

beforeEach(() => {
  setPresenceChoice('auto')
})

afterEach(() => {
  sockets.length = 0
  vi.unstubAllGlobals()
})

it('shows the current status and sends the chosen one', async () => {
  const socket = renderMenu()
  expect(trigger()).toHaveAccessibleName(/В сети/)

  await userEvent.click(trigger())
  expect(screen.getByRole('menuitemradio', { name: 'В сети' })).toBeChecked()

  await userEvent.click(screen.getByRole('menuitemradio', { name: 'Не беспокоить' }))

  expect(trigger()).toHaveAccessibleName(/Не беспокоить/)
  expect(socket?.sent).toContain(JSON.stringify({ type: 'status', status: 'dnd' }))

  await userEvent.click(trigger())
  expect(screen.getByRole('menuitemradio', { name: 'Не беспокоить' })).toBeChecked()
})

it('opens with the keyboard and returns focus on Escape', async () => {
  renderMenu()
  const button = trigger()
  button.focus()
  await userEvent.keyboard('{Enter}')

  expect(await screen.findByRole('menuitemradio', { name: 'Не активен' })).toBeInTheDocument()

  await userEvent.keyboard('{Escape}')
  expect(button).toHaveFocus()
})

it('offers the status and profile editors next to the statuses', async () => {
  renderMenu()
  await userEvent.click(trigger())

  expect(screen.getByRole('menuitem', { name: 'Задать статус' })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Редактировать профиль' })).toBeInTheDocument()
})
