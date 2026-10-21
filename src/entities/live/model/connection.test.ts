import { LiveConnection, liveUrl } from './connection'

/** A socket we drive by hand: no server, no timing luck. */
class FakeSocket {
  static readonly OPEN = 1
  readyState = 0
  readonly sent: string[] = []
  private listeners: Record<string, ((event: unknown) => void)[]> = {}

  addEventListener(type: string, listener: (event: unknown) => void) {
    ;(this.listeners[type] ??= []).push(listener)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.emit('close')
  }

  /** Pretends the connection came up. */
  accept() {
    this.readyState = FakeSocket.OPEN
    this.emit('open')
  }

  /** Pretends the connection dropped. */
  drop() {
    this.readyState = 3
    this.emit('close')
  }

  message(payload: unknown) {
    this.emit('message', { data: JSON.stringify(payload) })
  }

  private emit(type: string, event: unknown = {}) {
    for (const listener of this.listeners[type] ?? []) {
      listener(event)
    }
  }
}

function connect() {
  const sockets: FakeSocket[] = []
  const events: unknown[] = []
  const statuses: string[] = []
  const reconnects: number[] = []
  const connection = new LiveConnection(
    {
      onEvent: (event) => events.push(event),
      onStatus: (status) => statuses.push(status),
      onReconnect: () => reconnects.push(1),
    },
    'ws://api.test/api/v1/ws',
    () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket as unknown as WebSocket
    },
  )
  connection.open()
  return { connection, sockets, events, statuses, reconnects }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

it('builds the stream URL from the API address', () => {
  expect(liveUrl('http://localhost:8080')).toBe('ws://localhost:8080/api/v1/ws')
  expect(liveUrl('https://orbit.example')).toBe('wss://orbit.example/api/v1/ws')
})

it('subscribes once the socket is up, whichever came first', () => {
  const { connection, sockets } = connect()

  // Asked before the socket opened: it waits instead of dropping the frame.
  connection.subscribe('w1', { c1: 7 })
  expect(sockets[0]?.sent).toHaveLength(0)

  sockets[0]?.accept()

  expect(sockets[0]?.sent).toEqual([
    JSON.stringify({ type: 'subscribe', workspaceId: 'w1', cursors: { c1: 7 } }),
  ])
})

it('resumes the account stream once the socket is up and after a drop', () => {
  const { connection, sockets } = connect()

  connection.resume({ c1: 7 })
  expect(sockets[0]?.sent).toHaveLength(0)

  sockets[0]?.accept()
  expect(sockets[0]?.sent).toEqual([JSON.stringify({ type: 'resume', conversations: { c1: 7 } })])

  sockets[0]?.drop()
  vi.advanceTimersByTime(600)
  sockets[1]?.accept()
  expect(sockets[1]?.sent).toEqual([JSON.stringify({ type: 'resume', conversations: { c1: 7 } })])
})

it('sends the chosen status and activity once the socket is up, and again after a drop', () => {
  const { connection, sockets } = connect()

  connection.setStatus('dnd')
  connection.setActivity('active')
  expect(sockets[0]?.sent).toHaveLength(0)

  sockets[0]?.accept()
  expect(sockets[0]?.sent).toEqual([
    JSON.stringify({ type: 'status', status: 'dnd' }),
    JSON.stringify({ type: 'presence', activity: 'active' }),
  ])

  sockets[0]?.drop()
  vi.advanceTimersByTime(600)
  sockets[1]?.accept()

  expect(sockets[1]?.sent).toEqual([
    JSON.stringify({ type: 'status', status: 'dnd' }),
    JSON.stringify({ type: 'presence', activity: 'active' }),
  ])
})

it('passes events through and ignores a frame it cannot read', () => {
  const { sockets, events } = connect()
  sockets[0]?.accept()

  sockets[0]?.message({ type: 'message.created', channelId: 'c1', seq: 3 })
  sockets[0]?.message('не json')

  expect(events).toEqual([{ type: 'message.created', channelId: 'c1', seq: 3 }])
})

// The whole point of keeping the subscription: after a drop we watch the same
// server again, without the caller having to notice.
it('reconnects and re-subscribes by itself', () => {
  const { connection, sockets, statuses } = connect()
  sockets[0]?.accept()
  connection.subscribe('w1', { c1: 9 })

  sockets[0]?.drop()
  expect(statuses).toContain('reconnecting')

  vi.advanceTimersByTime(600)
  expect(sockets).toHaveLength(2)

  sockets[1]?.accept()
  expect(sockets[1]?.sent).toEqual([
    JSON.stringify({ type: 'subscribe', workspaceId: 'w1', cursors: { c1: 9 } }),
  ])
  expect(statuses.at(-1)).toBe('open')
})

it('waits longer after each failed attempt', () => {
  const { sockets } = connect()
  sockets[0]?.drop()

  vi.advanceTimersByTime(500)
  expect(sockets).toHaveLength(2)

  sockets[1]?.drop()
  // The second wait is longer, so a server that is down is not hammered.
  vi.advanceTimersByTime(500)
  expect(sockets).toHaveLength(2)
  vi.advanceTimersByTime(600)
  expect(sockets).toHaveLength(3)
})

it('stops for good when closed', () => {
  const { connection, sockets } = connect()
  sockets[0]?.accept()

  connection.close()
  vi.advanceTimersByTime(10_000)

  expect(sockets).toHaveLength(1)
})

// The first connection has nothing to catch up on; every later one does,
// because events from the gap never arrived.
it('reports a reconnect after a drop, not the first connection', () => {
  const { sockets, reconnects } = connect()
  sockets[0]?.accept()
  expect(reconnects).toHaveLength(0)

  sockets[0]?.drop()
  vi.runOnlyPendingTimers()
  sockets[1]?.accept()
  expect(reconnects).toHaveLength(1)
})

// Falling behind stops the server's stream while the socket stays up: the
// client starts over instead of waiting for events that will never come.
it('starts over when the server says the stream fell behind', () => {
  const { connection, sockets, events } = connect()
  connection.subscribe('w-1')
  sockets[0]?.accept()

  sockets[0]?.message({ type: 'error', code: 'behind', message: 'reconnect and catch up' })
  expect(events).toHaveLength(0)
  vi.runOnlyPendingTimers()

  expect(sockets).toHaveLength(2)
  sockets[1]?.accept()
  expect(sockets[1]?.sent.map((frame) => JSON.parse(frame) as { type: string })).toContainEqual(
    expect.objectContaining({ type: 'subscribe', workspaceId: 'w-1' }),
  )
})
