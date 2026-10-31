import type {
  PlatformSecretStore,
  PlatformAutostart,
  PlatformBadge,
  PlatformInstall,
  PlatformPush,
  PlatformPushToTalk,
  PlatformLinks,
  PlatformMediaDevices,
  PlatformNotifications,
  PlatformScreenCapture,
  PlatformSystem,
  ScreenCapture,
} from '@/shared/platform'

/**
 * A PlatformAdapter for unit tests: install it with `setPlatform(createFakePlatform())`
 * and reset with `setPlatform(null)`. Every method is a `vi.fn()` with a working default.
 */
export function createFakePlatform() {
  return {
    notifications: {
      permission: vi.fn<PlatformNotifications['permission']>(() => 'granted'),
      requestPermission: vi.fn<PlatformNotifications['requestPermission']>(() =>
        Promise.resolve('granted'),
      ),
      show: vi.fn<PlatformNotifications['show']>(),
    },
    badge: {
      set: vi.fn<PlatformBadge['set']>(),
    },
    mediaDevices: {
      list: vi.fn<PlatformMediaDevices['list']>(() => Promise.resolve([])),
      onChange: vi.fn<PlatformMediaDevices['onChange']>(() => () => undefined),
      requestAccess: vi.fn<PlatformMediaDevices['requestAccess']>(() => Promise.resolve(true)),
      canSelectOutput: vi.fn<PlatformMediaDevices['canSelectOutput']>(() => true),
      playTestSound: vi.fn<PlatformMediaDevices['playTestSound']>(() => Promise.resolve()),
    },
    screenCapture: {
      isSupported: vi.fn<PlatformScreenCapture['isSupported']>(() => true),
      capture: vi.fn<PlatformScreenCapture['capture']>(({ audio }) =>
        Promise.resolve(fakeScreenCapture({ audio })),
      ),
    },
    autostart: {
      isSupported: vi.fn<PlatformAutostart['isSupported']>(() => false),
      isEnabled: vi.fn<PlatformAutostart['isEnabled']>(() => Promise.resolve(false)),
      setEnabled: vi.fn<PlatformAutostart['setEnabled']>(() => Promise.resolve()),
    },
    secretStore: createFakeSecretStore(),
    system: {
      describe: vi.fn<PlatformSystem['describe']>(() => 'FakeBrowser/1.0 (TestOS)'),
    },
    push: {
      isSupported: vi.fn<PlatformPush['isSupported']>(() => Promise.resolve(true)),
      current: vi.fn<PlatformPush['current']>(() => Promise.resolve(null)),
      subscribe: vi.fn<PlatformPush['subscribe']>(() =>
        Promise.resolve({
          endpoint: 'https://fcm.googleapis.com/fcm/send/fake',
          keys: { p256dh: 'p256dh', auth: 'auth' },
        }),
      ),
      unsubscribe: vi.fn<PlatformPush['unsubscribe']>(() => Promise.resolve()),
      onOpen: vi.fn<PlatformPush['onOpen']>(() => () => undefined),
    },
    links: {
      isDesktop: vi.fn<PlatformLinks['isDesktop']>(() => false),
      onOpen: vi.fn<PlatformLinks['onOpen']>(() => () => undefined),
    },
    pushToTalk: {
      isSupported: vi.fn<PlatformPushToTalk['isSupported']>(() => false),
      register: vi.fn<PlatformPushToTalk['register']>(() => Promise.resolve(false)),
      onChange: vi.fn<PlatformPushToTalk['onChange']>(() => () => undefined),
    },
    install: {
      isSupported: vi.fn<PlatformInstall['isSupported']>(() => true),
      canPrompt: vi.fn<PlatformInstall['canPrompt']>(() => false),
      isInstalled: vi.fn<PlatformInstall['isInstalled']>(() => false),
      prompt: vi.fn<PlatformInstall['prompt']>(() => Promise.resolve('accepted')),
      onChange: vi.fn<PlatformInstall['onChange']>(() => () => undefined),
    },
  }
}

export function fakeScreenCapture({ audio }: { audio: boolean }): ScreenCapture {
  return {
    video: new FakeMediaStreamTrack('video'),
    audio: audio ? new FakeMediaStreamTrack('audio') : null,
  }
}

/** jsdom has no MediaStreamTrack; this one records `stop()`. */
export class FakeMediaStreamTrack extends EventTarget implements MediaStreamTrack {
  readonly id = crypto.randomUUID()
  readonly label = 'fake'
  readonly muted = false
  contentHint = ''
  enabled = true
  readyState: MediaStreamTrackState = 'live'
  onended: MediaStreamTrack['onended'] = null
  onmute: MediaStreamTrack['onmute'] = null
  onunmute: MediaStreamTrack['onunmute'] = null

  readonly kind: 'audio' | 'video'

  constructor(kind: 'audio' | 'video') {
    super()
    this.kind = kind
  }

  stop = vi.fn(() => {
    this.readyState = 'ended'
  })

  applyConstraints = () => Promise.resolve()
  clone = () => new FakeMediaStreamTrack(this.kind)
  getCapabilities = (): MediaTrackCapabilities => ({})
  getConstraints = (): MediaTrackConstraints => ({})
  getSettings = (): MediaTrackSettings => ({})
}

/** Device-local storage for tests: a Map instead of IndexedDB. */
export function createFakeSecretStore(): PlatformSecretStore {
  const values = new Map<string, Map<string, unknown>>()
  const scopeOf = (scope: string) => {
    const existing = values.get(scope)
    if (existing) {
      return existing
    }
    const created = new Map<string, unknown>()
    values.set(scope, created)
    return created
  }
  return {
    backend: 'indexeddb',
    get: <T>(scope: string, key: string, fallback: T | null) =>
      Promise.resolve((scopeOf(scope).get(key) as T | undefined) ?? fallback),
    set: <T>(scope: string, key: string, value: T) => {
      scopeOf(scope).set(key, value)
      return Promise.resolve(value)
    },
    remove: (scope: string, key: string) => {
      scopeOf(scope).delete(key)
      return Promise.resolve()
    },
    keys: (scope: string) => Promise.resolve([...scopeOf(scope).keys()]),
    clear: (scope: string) => {
      values.delete(scope)
      return Promise.resolve()
    },
  }
}
