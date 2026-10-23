import { expect, test } from '@playwright/test'

test('the app installs as a PWA and opens its shell without the network', async ({
  page,
  context,
}) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible()

  const manifest = await page.request.get('/manifest.webmanifest')
  expect(manifest.ok()).toBe(true)
  const data: unknown = await manifest.json()
  expect(data).toMatchObject({ name: 'Orbit', display: 'standalone', start_url: '/' })
  if (!isManifest(data)) {
    throw new Error('manifest has no icons')
  }
  expect(data.icons.length).toBeGreaterThanOrEqual(3)
  for (const icon of data.icons) {
    const response = await page.request.get(icon.src)
    expect(response.ok(), icon.src).toBe(true)
  }

  // Clients.claim() makes the worker take this page over without a second visit.
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready
    return navigator.serviceWorker.controller !== null
  })

  await context.setOffline(true)
  await page.reload()

  // The shell came from the cache; the API is unreachable and the app says so
  // instead of showing the browser's offline error page.
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible({ timeout: 20_000 })
})

test('a push becomes a notification with the path it points to', async ({ page, context }) => {
  // Headless Chromium refuses notifications whatever is granted, so the worker
  // is served with showNotification replaced by a probe that tells the page
  // what it was asked to show. The rest of sw.js runs as shipped.
  await context.route('**/sw.js', async (route) => {
    const response = await route.fetch()
    const probe = `
      self.registration.showNotification = async (title, options) => {
        const windows = await self.clients.matchAll({ includeUncontrolled: true })
        for (const client of windows) {
          client.postMessage({ type: 'probe:notification', title, options })
        }
      }
    `
    await route.fulfill({ response, body: probe + (await response.text()) })
  })
  await page.goto('/login')
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready
    return navigator.serviceWorker.controller !== null
  })
  const shown = page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        navigator.serviceWorker.addEventListener('message', (event: MessageEvent<unknown>) => {
          resolve(event.data)
        })
      }),
  )

  // Chromium in Playwright has no push service keys, so the push is handed to
  // the worker directly: what is tested is the worker's handling of it.
  const cdp = await context.newCDPSession(page)
  const registrationId = new Promise<string>((resolve) => {
    cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
      const own = registrations.find((r) => !r.isDeleted)
      if (own) {
        resolve(own.registrationId)
      }
    })
  })
  await cdp.send('ServiceWorker.enable')
  await cdp.send('ServiceWorker.deliverPushMessage', {
    origin: new URL(page.url()).origin,
    registrationId: await registrationId,
    data: JSON.stringify({ title: 'Анна', body: 'Новое сообщение', url: '/me/c-1', tag: 'c-1' }),
  })

  expect(await shown).toMatchObject({
    type: 'probe:notification',
    title: 'Анна',
    options: { body: 'Новое сообщение', tag: 'c-1', data: { path: '/me/c-1' } },
  })
})

function isManifest(value: unknown): value is { icons: { src: string }[] } {
  if (typeof value !== 'object' || value === null || !('icons' in value)) {
    return false
  }
  return Array.isArray(value.icons)
}
