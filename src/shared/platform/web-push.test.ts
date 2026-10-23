import { createWebPush } from './web-push'

const fakeSubscription = {
  toJSON: () => ({
    endpoint: 'https://fcm.googleapis.com/fcm/send/a',
    keys: { p256dh: 'k', auth: 'a' },
  }),
  unsubscribe: vi.fn(() => Promise.resolve(true)),
}

/** A service worker container with one registration whose push manager records the subscribe call. */
const stubServiceWorker = (registration: unknown) => {
  const container = Object.assign(new EventTarget(), {
    getRegistration: vi.fn(() => Promise.resolve(registration)),
  })
  vi.stubGlobal('navigator', { serviceWorker: container })
  // Only its presence matters: it tells a browser with the Push API.
  vi.stubGlobal('PushManager', vi.fn())
  return container
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('is unsupported without a registered service worker, as in pnpm dev', async () => {
  stubServiceWorker(undefined)
  const push = createWebPush()

  expect(await push.isSupported()).toBe(false)
  expect(await push.current()).toBeNull()
  await expect(push.subscribe('AQID')).rejects.toMatchObject({ name: 'NotSupportedError' })
})

it('subscribes with the key decoded from base64url', async () => {
  const subscribe = vi.fn(() => Promise.resolve(fakeSubscription))
  stubServiceWorker({
    pushManager: { subscribe, getSubscription: () => Promise.resolve(fakeSubscription) },
  })
  const push = createWebPush()

  const data = await push.subscribe('-_8') // bytes 0xfb 0xff

  expect(data).toEqual({
    endpoint: 'https://fcm.googleapis.com/fcm/send/a',
    keys: { p256dh: 'k', auth: 'a' },
  })
  expect(subscribe).toHaveBeenCalledWith({
    userVisibleOnly: true,
    applicationServerKey: new Uint8Array([0xfb, 0xff]),
  })
  await push.unsubscribe()
  expect(fakeSubscription.unsubscribe).toHaveBeenCalledOnce()
})

it('passes on only app paths the service worker sends', () => {
  const container = stubServiceWorker(undefined)
  const listener = vi.fn()
  const stop = createWebPush().onOpen(listener)

  const post = (data: unknown) => {
    container.dispatchEvent(new MessageEvent('message', { data }))
  }
  post({ type: 'orbit:open', path: '/me/c-1' })
  post({ type: 'orbit:open', path: '//evil.example/x' })
  post({ type: 'orbit:open', path: 'https://evil.example' })
  post({ type: 'something-else', path: '/s/1' })

  expect(listener.mock.calls).toEqual([['/me/c-1']])
  stop()
  post({ type: 'orbit:open', path: '/me/c-2' })
  expect(listener).toHaveBeenCalledOnce()
})
