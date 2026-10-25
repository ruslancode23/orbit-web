import http from 'node:http'


import { expect, test } from '@playwright/test'

import { password, skipProfileOnboarding, unique } from './helpers.ts'

import type { AddressInfo } from 'node:net'

// A 1×1 transparent PNG: enough for the browser to decode the proxied image.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const ogPage = `<!doctype html><html><head>
<meta property="og:title" content="Заголовок карточки">
<meta property="og:description" content="Описание из OpenGraph">
<meta property="og:site_name" content="Локальный сайт">
<meta property="og:image" content="/image.png">
<title>fallback</title>
</head><body>страница</body></html>`

test('shows the OpenGraph card of a link and lets the author remove it', async ({ page }) => {
  test.setTimeout(90_000)
  const server = http.createServer((request, response) => {
    if (request.url === '/page') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end(ogPage)
      return
    }
    if (request.url === '/image.png') {
      response.writeHead(200, { 'Content-Type': 'image/png' })
      response.end(PNG)
      return
    }
    response.writeHead(404)
    response.end()
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = (server.address() as AddressInfo).port

  try {
    await page.goto('/register')
    await page.getByLabel('Ник').fill(unique('превью'))
    await page.getByLabel('Пароль').fill(password)
    await page.getByRole('button', { name: 'Создать аккаунт' }).click()
    await skipProfileOnboarding(page)

    await page.getByRole('link', { name: 'Создать сервер' }).click()
    await page.getByLabel('Название сервера').fill(`Превью ${String(Date.now())}`)
    await page.getByRole('button', { name: 'Далее' }).click()
    await page.getByRole('radio', { name: /Пустой/ }).check()
    await page.getByRole('button', { name: 'Далее' }).click()
    await page.getByRole('button', { name: 'Создать сервер' }).click()

    await page.getByRole('button', { name: 'Меню сервера' }).click()
    await page.getByRole('menuitem', { name: 'Создать канал' }).click()
    await page.getByLabel('Название канала').fill('ссылки')
    await page.getByRole('button', { name: 'Создать', exact: true }).click()

    const url = `http://127.0.0.1:${String(port)}/page`
    await page.getByRole('textbox', { name: 'Сообщение' }).fill(`посмотри ${url}`)
    await page.getByRole('textbox', { name: 'Сообщение' }).press('Enter')

    const article = page.locator('[data-message-id]').last()
    const card = article.getByRole('link', { name: /Заголовок карточки/ })
    await expect(card).toBeVisible({ timeout: 15_000 })
    await expect(card).toHaveAttribute('href', url)
    await expect(article.getByText('Описание из OpenGraph')).toBeVisible()
    await expect(article.getByText('Локальный сайт')).toBeVisible()
    await expect(article.locator('img')).toHaveAttribute(
      'src',
      /\/api\/v1\/link-previews\/[0-9a-f-]+\/image$/u,
    )

    await article.getByRole('button', { name: 'Убрать превью' }).click()
    await expect(card).toHaveCount(0)
  } finally {
    server.close()
  }
})
