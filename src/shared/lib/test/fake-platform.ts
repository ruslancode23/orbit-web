import type {
  PlatformAutostart,
  PlatformInstall,
  PlatformMediaDevices,
  PlatformNotifications,
  PlatformScreenCapture,
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
