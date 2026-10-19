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
    expect(capture).toEqual({ video, audio })
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
