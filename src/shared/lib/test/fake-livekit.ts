/**
 * A stand-in for livekit-client's Room in unit tests:
 *
 *   vi.mock('livekit-client', async (importOriginal) => ({
 *     ...(await importOriginal<typeof LiveKit>()),
 *     Room: (await import('@/shared/lib/test')).FakeRoom,
 *   }))
 *
 * Tests drive it with `emit()` and inspect the `vi.fn()` methods.
 */
type Handler = (...args: unknown[]) => void

interface FakeLocalTrackPublication {
  source: string
}

export const fakeLiveKit = {
  rooms: [] as FakeRoom[],
  /** Makes the next microphone publish fail. */
  micError: null as Error | null,
  /** Makes the next screen share start fail. */
  screenError: null as Error | null,
  reset() {
    this.rooms.length = 0
    this.micError = null
    this.screenError = null
  },
  lastRoom(): FakeRoom {
    const room = this.rooms.at(-1)
    if (!room) throw new Error('no Room was created')
    return room
  },
}

export class FakeRoom {
  private handlers = new Map<string, Handler[]>()

  localParticipant = {
    identity: 'guest-me',
    name: '',
    isScreenShareEnabled: false,
    setMicrophoneEnabled: vi.fn(() =>
      fakeLiveKit.micError ? Promise.reject(fakeLiveKit.micError) : Promise.resolve(),
    ),
    setScreenShareEnabled: vi.fn((enabled: boolean) => {
      if (enabled && fakeLiveKit.screenError) return Promise.reject(fakeLiveKit.screenError)
      this.localParticipant.isScreenShareEnabled = enabled
      const publication: FakeLocalTrackPublication = { source: 'screen_share' }
      this.emit(enabled ? 'localTrackPublished' : 'localTrackUnpublished', publication)
      return Promise.resolve()
    }),
  }

  remoteParticipants = new Map<string, { identity: string; name: string }>()

  connect = vi.fn(() => {
    this.localParticipant.name = 'Anna'
    return Promise.resolve()
  })

  startAudio = vi.fn(() => Promise.resolve())

  disconnect = vi.fn(() => {
    this.emit('disconnected')
    return Promise.resolve()
  })

  constructor() {
    fakeLiveKit.rooms.push(this)
  }

  on(event: string, handler: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
    return this
  }

  emit(event: string, ...args: unknown[]) {
    for (const handler of this.handlers.get(event) ?? []) handler(...args)
  }
}
