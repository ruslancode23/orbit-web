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

const isFakeMicrophoneTrack = (track: unknown): track is FakeMicrophoneTrack =>
  typeof track === 'object' && track !== null && 'kind' in track && track.kind === 'audio'

export const fakeLiveKit = {
  rooms: [] as FakeRoom[],
  /** Makes the next microphone publish fail. */
  micError: null as Error | null,
  /** Makes the next publishTrack fail. */
  publishError: null as Error | null,
  reset() {
    this.rooms.length = 0
    this.micError = null
    this.publishError = null
  },
  lastRoom(): FakeRoom {
    const room = this.rooms.at(-1)
    if (!room) {
      throw new Error('no Room was created')
    }
    return room
  },
}

/** The local microphone once it is published; `restartTrack` is how processing changes reach it. */
export interface FakeMicrophoneTrack {
  kind: 'audio'
  isMuted: boolean
  mute: () => Promise<void>
  restartTrack: (options?: Record<string, unknown>) => Promise<void>
}

const fakeMicrophoneTrack = (): FakeMicrophoneTrack => {
  const track: FakeMicrophoneTrack = {
    kind: 'audio',
    isMuted: false,
    mute: vi.fn(() => {
      track.isMuted = true
      return Promise.resolve()
    }),
    restartTrack: vi.fn(() => Promise.resolve()),
  }
  return track
}

/**
 * Stands in for livekit-client's `createLocalAudioTrack`, which push-to-talk
 * uses to publish the microphone muted. Mock it next to `Room`:
 * `createLocalAudioTrack: (await import('@/shared/lib/test')).fakeCreateLocalAudioTrack`.
 */
export const fakeCreateLocalAudioTrack = vi.fn((_options?: unknown) =>
  Promise.resolve(fakeMicrophoneTrack()),
)

export class FakeRoom {
  private handlers = new Map<string, Handler[]>()

  /** What the app passed to `new Room()`; `audioCaptureDefaults` is updated in place, as LiveKit allows. */
  options: { audioCaptureDefaults?: Record<string, unknown> } & Record<string, unknown>

  /** Null until the first `setMicrophoneEnabled(true)`. */
  microphoneTrack: FakeMicrophoneTrack | null = null

  /** What `getActiveDevice` answers, by kind. */
  activeDevices: Partial<Record<string, string>> = {}

  getActiveDevice = vi.fn((kind: string) => this.activeDevices[kind])

  localParticipant = {
    identity: 'guest-me',
    name: '',
    isScreenShareEnabled: false,
    isMicrophoneEnabled: false,
    isSpeaking: false,
    attributes: {} as Record<string, string>,
    setMicrophoneEnabled: vi.fn((enabled: boolean) => {
      if (fakeLiveKit.micError) {
        return Promise.reject(fakeLiveKit.micError)
      }
      this.localParticipant.isMicrophoneEnabled = enabled
      if (enabled && !this.microphoneTrack) {
        this.microphoneTrack = fakeMicrophoneTrack()
      }
      if (this.microphoneTrack) {
        this.microphoneTrack.isMuted = !enabled
      }
      this.emit(enabled ? 'trackUnmuted' : 'trackMuted', { source: 'microphone' })
      return Promise.resolve()
    }),
    getTrackPublication: vi.fn((source: string) =>
      source === 'microphone' && this.microphoneTrack
        ? { source, track: this.microphoneTrack, audioTrack: this.microphoneTrack }
        : undefined,
    ),
    setAttributes: vi.fn((attributes: Record<string, string>) => {
      this.localParticipant.attributes = { ...this.localParticipant.attributes, ...attributes }
      this.emit('participantAttributesChanged', attributes, this.localParticipant)
      return Promise.resolve()
    }),
    // Only stopping goes through LiveKit: the app captures the screen with the platform adapter.
    setScreenShareEnabled: vi.fn((enabled: boolean) => {
      this.localParticipant.isScreenShareEnabled = enabled
      const publication: FakeLocalTrackPublication = { source: 'screen_share' }
      this.emit(enabled ? 'localTrackPublished' : 'localTrackUnpublished', publication)
      return Promise.resolve()
    }),
    publishTrack: vi.fn((track: unknown, { source }: { source: string }) => {
      if (fakeLiveKit.publishError) {
        return Promise.reject(fakeLiveKit.publishError)
      }
      if (source === 'screen_share') {
        this.localParticipant.isScreenShareEnabled = true
      }
      if (source === 'microphone' && isFakeMicrophoneTrack(track)) {
        this.microphoneTrack = track
        this.localParticipant.isMicrophoneEnabled = !track.isMuted
      }
      const publication: FakeLocalTrackPublication = { source }
      this.emit('localTrackPublished', publication)
      return Promise.resolve(publication)
    }),
  }

  remoteParticipants = new Map<string, FakeRemoteParticipant>()

  connect = vi.fn(() => {
    this.localParticipant.name = 'Anna'
    return Promise.resolve()
  })

  startAudio = vi.fn(() => Promise.resolve())

  disconnect = vi.fn(() => {
    this.emit('disconnected', 1) // DisconnectReason.CLIENT_INITIATED
    return Promise.resolve()
  })

  constructor(options: FakeRoom['options'] = {}) {
    this.options = options
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
    for (const handler of this.handlers.get(event) ?? []) {
      handler(...args)
    }
  }
}
