// Orbit's service worker: keeps the app shell so the installed app opens without
// the network. API calls, WebSocket upgrades and LiveKit media never go through
// the cache: a stale message or a stale room would be worse than an error.
const VERSION = 'orbit-v1'
const SHELL = '/'
const PRECACHE = [
  SHELL,
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION)
      await cache.addAll(PRECACHE)
      // Vite puts hashed JS and CSS in the built index; without them the cached
      // shell would open to a blank page. The names change every build.
      const response = await fetch(SHELL)
      const html = await response.text()
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(
        (match) => match[1],
      )
      await cache.addAll(assets)
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name !== VERSION).map((name) => caches.delete(name)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.svg' ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(cacheFirstAsset(request))
  }
})

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(VERSION)
      // Every route is the same index.html: keep one copy as the fallback.
      await cache.put(SHELL, response.clone())
    }
    return response
  } catch {
    const cache = await caches.open(VERSION)
    // Preview and dev servers put `Vary: Origin` on everything; a module script
    // asks with an Origin header while the install-time fetch did not, and a
    // plain match would miss. The cache is ours and the URL is the identity.
    const cached = await cache.match(SHELL, { ignoreVary: true })
    if (cached) {
      return cached
    }
    return new Response(
      '<!doctype html><html lang="ru"><meta charset="utf-8"><title>Orbit</title>' +
        '<body style="font-family: sans-serif; padding: 2rem">Нет сети, а оболочка ещё не сохранена. ' +
        'Откройте Orbit онлайн хотя бы раз.</body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request, { ignoreVary: true })
  if (cached) {
    return cached
  }
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(VERSION)
    await cache.put(request, response.clone())
  }
  return response
}

// Web Push (orbit-server internal/push). The payload is what the server chose
// to say — who wrote and where, never the text — and `url` is a path inside
// the app. Every push shows a notification: browsers punish silent ones.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // A payload that is not JSON still deserves a notification.
  }
  const title = typeof data.title === 'string' && data.title !== '' ? data.title : 'Orbit'
  const path = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body : undefined,
      tag: typeof data.tag === 'string' ? data.tag : undefined,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { path },
    }),
  )
})

// A click brings an open Orbit window forward and lets the app route there
// itself; with no window open it starts one on that path.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const raw = event.notification.data && event.notification.data.path
  const path = typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const own = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (own) {
        await own.focus()
        own.postMessage({ type: 'orbit:open', path })
        return
      }
      await self.clients.openWindow(path)
    })(),
  )
})
