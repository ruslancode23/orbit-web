import { FakeMediaStreamTrack } from '@/shared/lib/test'

import { createWebPlatform } from './web-platform'

function stubMediaDevices(devices: object | undefined) {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: devices })
}

function stream(...tracks: FakeMediaStreamTrack[]) {
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'mediaDevices')
})

describe('web platform: links', () => {
  it('is not the desktop shell and hears no deep links', () => {
    const platform = createWebPlatform()

    expect(platform.links.isDesktop()).toBe(false)
    expect(platform.links.onOpen(() => undefined)).toBeTypeOf('function')
  })
})

describe('web platform: icon badge', () => {
  it('uses the browser badge when the page is an installed app', () => {
    const setAppBadge = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'setAppBadge', { configurable: true, value: setAppBadge })

    createWebPlatform().badge.set(4)

    expect(setAppBadge).toHaveBeenCalledWith(4)
    Reflect.deleteProperty(navigator, 'setAppBadge')
  })

  it('does nothing in a browser without a badge', () => {
    expect(() => {
      createWebPlatform().badge.set(4)
    }).not.toThrow()
  })
})

describe('web platform: screen capture', () => {
  it('asks the browser for a capped screen with audio and returns its tracks', async () => {
    const video = new FakeMediaStreamTrack('video')
    const audio = new FakeMediaStreamTrack('audio')
    const getDisplayMedia = vi.fn(() => Promise.resolve(stream(video, audio)))
    stubMediaDevices({ getDisplayMedia })

    const capture = await createWebPlatform().screenCapture.capture({ audio: true })

    expect(getDisplayMedia).toHaveBeenCalledWith({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: 30 },
      audio: true,
    })
    expect(video.contentHint).toBe('detail')
    expect(capture).toEqual({ video, audio })
  })

  it('captures at the chosen quality and hints motion for 60 fps', async () => {
    const video = new FakeMediaStreamTrack('video')
    const getDisplayMedia = vi.fn(() => Promise.resolve(stream(video)))
    stubMediaDevices({ getDisplayMedia })

    await createWebPlatform().screenCapture.capture({
      audio: false,
      quality: { resolution: '720p', frameRate: 60 },
    })

    expect(getDisplayMedia).toHaveBeenCalledWith({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: 60 },
      audio: false,
    })
    expect(video.contentHint).toBe('motion')
  })

  it('still captures when the track refuses the content hint', async () => {
    const video = new FakeMediaStreamTrack('video')
    Object.defineProperty(video, 'contentHint', {
      configurable: true,
      get: () => '',
      set: () => {
        throw new TypeError('contentHint is read-only here')
      },
    })
    stubMediaDevices({ getDisplayMedia: () => Promise.resolve(stream(video)) })

    await expect(
      createWebPlatform().screenCapture.capture({
        audio: false,
        quality: { resolution: '1080p', frameRate: 60 },
      }),
    ).resolves.toEqual({ video, audio: null })
  })

  it('returns no audio when the user did not share it', async () => {
    const video = new FakeMediaStreamTrack('video')
    stubMediaDevices({ getDisplayMedia: () => Promise.resolve(stream(video)) })

    await expect(createWebPlatform().screenCapture.capture({ audio: true })).resolves.toEqual({
      video,
      audio: null,
    })
  })

  it('passes the closed picker through as NotAllowedError', async () => {
    const denied = new DOMException('Permission denied', 'NotAllowedError')
    stubMediaDevices({ getDisplayMedia: () => Promise.reject(denied) })

    await expect(createWebPlatform().screenCapture.capture({ audio: false })).rejects.toBe(denied)
  })

  it('stops the capture when it has no video', async () => {
    const audio = new FakeMediaStreamTrack('audio')
    stubMediaDevices({ getDisplayMedia: () => Promise.resolve(stream(audio)) })

    await expect(createWebPlatform().screenCapture.capture({ audio: true })).rejects.toMatchObject({
      name: 'NotFoundError',
    })
    expect(audio.stop).toHaveBeenCalled()
  })

  it('reports a browser without screen capture as NotSupportedError', async () => {
    const platform = createWebPlatform()

    expect(platform.screenCapture.isSupported()).toBe(false)
    await expect(platform.screenCapture.capture({ audio: true })).rejects.toMatchObject({
      name: 'NotSupportedError',
    })
  })
})

describe('web platform: media devices', () => {
  it('lists devices of one kind', async () => {
    const mic = { kind: 'audioinput', deviceId: 'mic' }
    const speaker = { kind: 'audiooutput', deviceId: 'out' }
    stubMediaDevices({
      enumerateDevices: () => Promise.resolve([mic, speaker]),
    })

    await expect(createWebPlatform().mediaDevices.list('audioinput')).resolves.toEqual([mic])
  })

  it('subscribes to device changes and unsubscribes', () => {
    const target = new EventTarget()
    stubMediaDevices({
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
    })
    const listener = vi.fn()

    const unsubscribe = createWebPlatform().mediaDevices.onChange(listener)
    target.dispatchEvent(new Event('devicechange'))
    unsubscribe()
    target.dispatchEvent(new Event('devicechange'))

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('fails listing without media devices (insecure context)', async () => {
    await expect(createWebPlatform().mediaDevices.list('audioinput')).rejects.toMatchObject({
      name: 'NotSupportedError',
    })
  })
})

describe('web platform: notifications', () => {
  function stubNotification(permission: NotificationPermission) {
    const shown = new EventTarget()
    const close = vi.fn()
    // Called with `new`: the object it returns becomes the notification.
    const NotificationMock = Object.assign(
      vi.fn(function () {
        return Object.assign(shown, { close })
      }),
      { shown, close, permission, requestPermission: vi.fn(() => Promise.resolve('granted')) },
    )
    vi.stubGlobal('Notification', NotificationMock)
    return NotificationMock
  }

  it('shows a notification once permitted', () => {
    const NotificationMock = stubNotification('granted')

    createWebPlatform().notifications.show({ title: 'Anna', body: 'зашла в комнату' })

    expect(NotificationMock).toHaveBeenCalledWith('Anna', { body: 'зашла в комнату' })
  })

  it('focuses the app and runs the click handler when clicked', () => {
    const NotificationMock = stubNotification('granted')
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => undefined)
    const onClick = vi.fn()

    createWebPlatform().notifications.show({ title: 'Anna', tag: 'channel-1', onClick })
    NotificationMock.shown.dispatchEvent(new Event('click'))

    expect(NotificationMock).toHaveBeenCalledWith('Anna', { tag: 'channel-1' })
    expect(focus).toHaveBeenCalled()
    expect(NotificationMock.close).toHaveBeenCalled()
    expect(onClick).toHaveBeenCalled()
  })

  it('shows nothing without permission', () => {
    const NotificationMock = stubNotification('default')

    createWebPlatform().notifications.show({ title: 'Anna' })

    expect(NotificationMock).not.toHaveBeenCalled()
  })

  it('requests permission from the browser', async () => {
    const NotificationMock = stubNotification('default')

    await expect(createWebPlatform().notifications.requestPermission()).resolves.toBe('granted')
    expect(NotificationMock.requestPermission).toHaveBeenCalled()
  })

  it('reports a browser without notifications', async () => {
    vi.stubGlobal('Notification', undefined)
    const { notifications } = createWebPlatform()

    expect(notifications.permission()).toBe('unsupported')
    await expect(notifications.requestPermission()).resolves.toBe('unsupported')
  })
})

describe('web platform: autostart', () => {
  it('is not available in the browser', async () => {
    const { autostart } = createWebPlatform()

    expect(autostart.isSupported()).toBe(false)
    await expect(autostart.isEnabled()).resolves.toBe(false)
    await expect(autostart.setEnabled(true)).rejects.toMatchObject({ name: 'NotSupportedError' })
  })
})

describe('web platform: install', () => {
  it('refuses to prompt without an offer', async () => {
    const platform = createWebPlatform()

    await expect(platform.install.prompt()).rejects.toMatchObject({ name: 'NotSupportedError' })
  })

  const installEvent = (outcome: 'accepted' | 'dismissed') => {
    const prompt = vi.fn(() => Promise.resolve())
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt,
      userChoice: Promise.resolve({ outcome, platform: 'web' }),
    })
    window.dispatchEvent(event)
    return prompt
  }

  it('keeps the prompt the browser offered and spends it once', async () => {
    const prompt = installEvent('accepted')
    const platform = createWebPlatform()

    expect(platform.install.canPrompt()).toBe(true)
    await expect(platform.install.prompt()).resolves.toBe('accepted')
    expect(prompt).toHaveBeenCalled()
    expect(platform.install.canPrompt()).toBe(false)
  })

  it('tells subscribers when the prompt appears', () => {
    const platform = createWebPlatform()
    const listener = vi.fn()
    const unsubscribe = platform.install.onChange(listener)

    installEvent('dismissed')

    expect(listener).toHaveBeenCalled()
    unsubscribe()
  })

  it('reports the installed app from the display mode', () => {
    const matchMedia = vi.fn(() => ({ matches: true }))
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia })

    expect(createWebPlatform().install.isInstalled()).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith('(display-mode: standalone)')

    Reflect.deleteProperty(window, 'matchMedia')
  })
})

describe('web platform: system', () => {
  it('describes itself by the browser user agent', () => {
    expect(createWebPlatform().system.describe()).toBe(navigator.userAgent)
  })
})
