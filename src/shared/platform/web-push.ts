import type { PlatformPush, PushSubscriptionData } from './platform-adapter'

/** The service worker posts this when a push notification is clicked (`public/sw.js`). */
const OPEN_MESSAGE = 'orbit:open'

const hasPush = (): boolean =>
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  typeof window !== 'undefined' &&
  'PushManager' in window

/** The registration of `/sw.js`, without waiting for one that was never registered (dev). */
const registration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!hasPush()) {
    return null
  }
  const found = await navigator.serviceWorker.getRegistration()
  return found ?? null
}

// PushManager wants the key as bytes; the server hands it over in base64url.
const keyBytes = (base64url: string): Uint8Array<ArrayBuffer> => {
  const padded = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(base64url.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

const toData = (subscription: PushSubscription): PushSubscriptionData => {
  const json = subscription.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (json.endpoint === undefined || p256dh === undefined || auth === undefined) {
    throw new DOMException('The browser gave a subscription without keys', 'NotSupportedError')
  }
  return { endpoint: json.endpoint, keys: { p256dh, auth } }
}

export function createWebPush(): PlatformPush {
  return {
    async isSupported() {
      return (await registration()) !== null
    },
    async current() {
      const found = await registration()
      const subscription = await found?.pushManager.getSubscription()
      return subscription ? toData(subscription) : null
    },
    async subscribe(applicationServerKey) {
      const found = await registration()
      if (!found) {
        throw new DOMException('Push needs the service worker', 'NotSupportedError')
      }
      const subscription = await found.pushManager.subscribe({
        // Every push shows a notification; browsers refuse silent pushes anyway.
        userVisibleOnly: true,
        applicationServerKey: keyBytes(applicationServerKey),
      })
      return toData(subscription)
    },
    async unsubscribe() {
      const found = await registration()
      const subscription = await found?.pushManager.getSubscription()
      await subscription?.unsubscribe()
    },
    onOpen(listener) {
      if (!hasPush()) {
        return () => undefined
      }
      const handle = (event: MessageEvent<unknown>) => {
        const data = event.data
        if (
          typeof data === 'object' &&
          data !== null &&
          'type' in data &&
          data.type === OPEN_MESSAGE &&
          'path' in data &&
          typeof data.path === 'string' &&
          data.path.startsWith('/') &&
          !data.path.startsWith('//')
        ) {
          listener(data.path)
        }
      }
      navigator.serviceWorker.addEventListener('message', handle)
      return () => {
        navigator.serviceWorker.removeEventListener('message', handle)
      }
    },
  }
}
