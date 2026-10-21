import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/shared/lib/test'

import { LiveProvider } from './LiveProvider'
import { IDLE_AFTER_MS, setPresenceChoice, useMyStatus, usePresenceActivity } from './presence'

import type { ReactNode } from 'react'

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

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
}

const ActivityProbe = () => {
  usePresenceActivity()
  return null
}

const StatusProbe = () => {
  const { status, choose } = useMyStatus()
  return (
    <div>
      <span>{status}</span>
      <button
        type="button"
        onClick={() => {
          choose('dnd')
        }}
      >
        Не беспокоить
      </button>
    </div>
  )
}

const renderWithLive = (node: ReactNode) => {
  vi.stubGlobal('WebSocket', FakeSocket)
  return renderWithProviders(<LiveProvider enabled>{node}</LiveProvider>)
}

beforeEach(() => {
  setPresenceChoice('auto')
  setVisibility('visible')
  sockets.length = 0
})

afterEach(() => {
  vi.useRealTimers()
  setVisibility('visible')
  vi.unstubAllGlobals()
})

it('sends idle after five minutes without input and active again on input', () => {
  vi.useFakeTimers()
  renderWithLive(<ActivityProbe />)
  const socket = sockets[0]
  act(() => {
    socket?.accept()
  })

  expect(socket?.sent).toContain(JSON.stringify({ type: 'presence', activity: 'active' }))

  act(() => {
    vi.advanceTimersByTime(IDLE_AFTER_MS)
  })
  expect(socket?.sent).toContain(JSON.stringify({ type: 'presence', activity: 'idle' }))

  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown'))
  })
  expect(socket?.sent.at(-1)).toBe(JSON.stringify({ type: 'presence', activity: 'active' }))
})

it('goes idle when the tab is hidden and active when it comes back', () => {
  renderWithLive(<ActivityProbe />)
  const socket = sockets[0]
  act(() => {
    socket?.accept()
  })

  act(() => {
    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(socket?.sent).toContain(JSON.stringify({ type: 'presence', activity: 'idle' }))

  act(() => {
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(socket?.sent.at(-1)).toBe(JSON.stringify({ type: 'presence', activity: 'active' }))
})

it('sends the chosen status and shows it as current', async () => {
  renderWithLive(<StatusProbe />)
  const socket = sockets[0]
  act(() => {
    socket?.accept()
  })

  expect(screen.getByText('auto')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Не беспокоить' }))

  expect(screen.getByText('dnd')).toBeInTheDocument()
  expect(socket?.sent).toContain(JSON.stringify({ type: 'status', status: 'dnd' }))
})

it('sends the remembered status again on a fresh connection', () => {
  setPresenceChoice('invisible')
  renderWithLive(<ActivityProbe />)
  const socket = sockets[0]
  act(() => {
    socket?.accept()
  })

  expect(socket?.sent).toContain(JSON.stringify({ type: 'status', status: 'invisible' }))
})
