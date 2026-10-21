import { env } from '@/shared/config'

import type { PresenceActivity, PresenceChoice } from './presence'

/** What the server sends; `type` names the event (see orbit-server README). */
export interface LiveEvent {
  type: string
  workspaceId?: string
  channelId?: string
  seq?: number
  payload?: unknown
  code?: string
  message?: string
}

export type LiveStatus = 'connecting' | 'open' | 'reconnecting' | 'offline'

interface ConnectionHandlers {
  onEvent: (event: LiveEvent) => void
  onStatus: (status: LiveStatus) => void
}

/** How long to wait before trying again, growing with each failure. */
const RETRY_DELAYS_MS = [500, 1000, 2000, 5000, 10_000]

/** The URL of the live stream, derived from the API's own address. */
export function liveUrl(apiUrl = env.apiUrl): string {
  const url = new URL('/api/v1/ws', apiUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

/**
 * One WebSocket for the whole app: it reconnects by itself, and switching
 * channels or servers only re-subscribes — it never drops the socket.
 *
 * Reconnecting is why the subscription is kept here: after the socket comes
 * back, the same `subscribe` frame is sent again, with the cursors the caller
 * last gave, so nothing is missed and nothing arrives twice.
 */
export class LiveConnection {
  private socket: WebSocket | undefined
  private retry = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private closed = false
  private subscription: { workspaceId: string; cursors: Record<string, number> } | undefined
  /** Per-conversation cursors of the account stream: a dialogue has no server. */
  private conversations: Record<string, number> | undefined
  /** The status the account picked, repeated after every reconnect. */
  private status: PresenceChoice | undefined
  /** What this tab says about itself, repeated after every reconnect. */
  private activity: PresenceActivity | undefined

  private readonly handlers: ConnectionHandlers
  private readonly url: string
  private readonly createSocket: (url: string) => WebSocket

  constructor(
    handlers: ConnectionHandlers,
    url: string = liveUrl(),
    createSocket: (target: string) => WebSocket = (target) => new WebSocket(target),
  ) {
    this.handlers = handlers
    this.url = url
    this.createSocket = createSocket
  }

  open(): void {
    if (this.closed || this.socket) {
      return
    }
    this.handlers.onStatus(this.retry === 0 ? 'connecting' : 'reconnecting')

    const socket = this.createSocket(this.url)
    this.socket = socket

    socket.addEventListener('open', () => {
      this.retry = 0
      this.handlers.onStatus('open')
      // Whatever we were watching, we watch again.
      if (this.subscription) {
        this.sendSubscribe(this.subscription)
      }
      if (this.conversations) {
        this.sendResume(this.conversations)
      }
      // The server keeps presence in memory: after a reconnect it has to learn
      // both the chosen status and what this tab said about itself.
      if (this.status) {
        this.sendStatus(this.status)
      }
      if (this.activity) {
        this.sendActivity(this.activity)
      }
    })

    socket.addEventListener('message', (message: MessageEvent<string>) => {
      const event = parseEvent(message.data)
      if (event) {
        this.handlers.onEvent(event)
      }
    })

    socket.addEventListener('close', () => {
      this.socket = undefined
      if (this.closed) {
        return
      }
      this.scheduleRetry()
    })

    // An error is always followed by a close; the retry happens there.
    socket.addEventListener('error', () => {
      this.handlers.onStatus('reconnecting')
    })
  }

  /** Watch one server. Called again with new cursors as the person reads. */
  subscribe(workspaceId: string, cursors: Record<string, number> = {}): void {
    this.subscription = { workspaceId, cursors }
    this.sendSubscribe(this.subscription)
  }

  /**
   * Catch up the account stream: the dialogs this device has and where it
   * stopped in each. Conversations belong to no server, so this is a separate
   * frame the socket repeats after a reconnect.
   */
  resume(conversations: Record<string, number>): void {
    this.conversations = conversations
    this.sendResume(conversations)
  }

  /**
   * The status the account picked, for one device and therefore all of them.
   * Kept here so a reconnect repeats it without the caller watching `status`.
   */
  setStatus(status: PresenceChoice): void {
    this.status = status
    this.sendStatus(status)
  }

  /**
   * What this tab says about itself: hidden or untouched means idle. Kept here
   * for the same reason as the status: a reconnect must repeat it.
   */
  setActivity(activity: PresenceActivity): void {
    this.activity = activity
    this.sendActivity(activity)
  }

  close(): void {
    this.closed = true
    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.socket?.close()
    this.socket = undefined
  }

  private sendSubscribe(subscription: { workspaceId: string; cursors: Record<string, number> }) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return
    }
    this.socket.send(JSON.stringify({ type: 'subscribe', ...subscription }))
  }

  private sendResume(conversations: Record<string, number>) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return
    }
    this.socket.send(JSON.stringify({ type: 'resume', conversations }))
  }

  private sendStatus(status: PresenceChoice) {
    this.send({ type: 'status', status })
  }

  private sendActivity(activity: PresenceActivity) {
    this.send({ type: 'presence', activity })
  }

  private send(frame: object) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return
    }
    this.socket.send(JSON.stringify(frame))
  }

  private scheduleRetry() {
    const delay = RETRY_DELAYS_MS[Math.min(this.retry, RETRY_DELAYS_MS.length - 1)] ?? 10_000
    this.retry += 1
    this.handlers.onStatus(this.retry > 1 ? 'offline' : 'reconnecting')
    this.timer = setTimeout(() => {
      this.open()
    }, delay)
  }
}

function parseEvent(raw: string): LiveEvent | undefined {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined
    }
    const event = parsed as LiveEvent
    return typeof event.type === 'string' ? event : undefined
  } catch {
    // A frame we cannot read is not worth tearing the connection down for.
    return undefined
  }
}
