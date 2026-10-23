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

const StatusProbe = ({
  onReportBug = () => undefined,
  signature = '',
}: {
  onReportBug?: () => void
  signature?: string
}) => {
  const { status, choose } = useMyStatus()
  return (
    <UserStatusMenu
      status={status}
      onStatusChange={choose}
      onEditProfile={() => undefined}
      onSetStatus={() => undefined}
      signature={signature}
      onReportBug={onReportBug}
    >
      <span>Анна</span>
    </UserStatusMenu>
  )
}

const renderMenu = (onReportBug?: () => void, signature?: string) => {
  vi.stubGlobal('WebSocket', FakeSocket)
  renderWithProviders(
    <LiveProvider enabled>
      <StatusProbe
        {...(onReportBug === undefined ? {} : { onReportBug })}
        {...(signature === undefined ? {} : { signature })}
      />
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

it('offers the signature and profile editors next to the statuses', async () => {
  renderMenu()
  await userEvent.click(trigger())

  // «Статус» names the presence only: the emoji and text are the signature.
  expect(screen.getByRole('menuitem', { name: 'Задать подпись' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: /статус/i })).not.toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Редактировать профиль' })).toBeInTheDocument()
})

it('shows the current signature and offers to change it', async () => {
  renderMenu(undefined, '☕ На встрече')
  await userEvent.click(trigger())

  expect(
    screen.getByRole('menuitem', { name: /^Изменить подпись.*☕ На встрече$/ }),
  ).toBeInTheDocument()
})

it('offers to report a problem', async () => {
  const onReportBug = vi.fn()
  renderMenu(onReportBug)
  await userEvent.click(trigger())

  await userEvent.click(screen.getByRole('menuitem', { name: 'Сообщить о проблеме' }))

  expect(onReportBug).toHaveBeenCalledOnce()
})
