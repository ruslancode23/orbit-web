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

export interface FakeRemoteParticipant {
  identity: string
  name: string
  isSpeaking: boolean
  isMicrophoneEnabled: boolean
  attributes: Record<string, string>
  setVolume: (volume: number, source?: string) => void
}

/** A remote participant with a published, unmuted microphone. */
export function fakeRemoteParticipant(
  identity: string,
  name: string,
  overrides: Partial<FakeRemoteParticipant> = {},
): FakeRemoteParticipant {
  return {
    identity,
    name,
    isSpeaking: false,
    isMicrophoneEnabled: true,
    attributes: {},
    setVolume: vi.fn(),
    ...overrides,
  }
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
    isMicrophoneEnabled: false,
    isSpeaking: false,
    attributes: {} as Record<string, string>,
    setMicrophoneEnabled: vi.fn((enabled: boolean) => {
      if (fakeLiveKit.micError) return Promise.reject(fakeLiveKit.micError)
      this.localParticipant.isMicrophoneEnabled = enabled
      this.emit(enabled ? 'trackUnmuted' : 'trackMuted', { source: 'microphone' })
      return Promise.resolve()
    }),
    setAttributes: vi.fn((attributes: Record<string, string>) => {
      this.localParticipant.attributes = { ...this.localParticipant.attributes, ...attributes }
      this.emit('participantAttributesChanged', attributes, this.localParticipant)
      return Promise.resolve()
    }),
    setScreenShareEnabled: vi.fn((enabled: boolean) => {
      if (enabled && fakeLiveKit.screenError) return Promise.reject(fakeLiveKit.screenError)
      this.localParticipant.isScreenShareEnabled = enabled
      const publication: FakeLocalTrackPublication = { source: 'screen_share' }
      this.emit(enabled ? 'localTrackPublished' : 'localTrackUnpublished', publication)
      return Promise.resolve()
    }),
  }

  remoteParticipants = new Map<string, FakeRemoteParticipant>()

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

  off(event: string, handler: Handler) {
    this.handlers.set(
      event,
      (this.handlers.get(event) ?? []).filter((h) => h !== handler),
    )
    return this
  }

  emit(event: string, ...args: unknown[]) {
    for (const handler of this.handlers.get(event) ?? []) handler(...args)
  }
}
