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

function isManifest(value: unknown): value is { icons: { src: string }[] } {
  if (typeof value !== 'object' || value === null || !('icons' in value)) {
    return false
  }
  return Array.isArray(value.icons)
}
