import { expect, test, type Page } from '@playwright/test'

import { createChannel } from './helpers.ts'

const unique = () => `files${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`
const password = 'a-long-enough-password'

// A real 2×2 PNG: the server reads the type from the bytes, not the name.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg==',
  'base64',
)

async function openChannel(page: Page) {
  await page.goto('/register')
  await page.getByLabel('Ник').fill(unique())
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()

  await page.getByRole('link', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill('Команда')
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('radio', { name: /Пустой/ }).check()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Создать сервер' }).click()

  await createChannel(page, 'общий')
}

const fileInput = (page: Page) => page.locator('input[type="file"]')

test('an image is uploaded, previewed from a signed link and opened in full size', async ({
  page,
}) => {
  await openChannel(page)

  await fileInput(page).setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('list', { name: 'Файлы к сообщению' })).toContainText('dot.png')
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await page.getByRole('button', { name: 'Отправить' }).click()

  const preview = page.getByRole('img', { name: 'dot.png' })
  await expect(preview).toBeVisible()
  // The browser really drew it: the signed link led to the file.
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(2)

  await page.getByRole('button', { name: 'Открыть dot.png в полном размере' }).click()
  await expect(page.getByRole('dialog', { name: 'dot.png' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('img', { name: 'dot.png' })).toBeVisible()
})

test('a file goes with a message and downloads by a signed link', async ({ page }) => {
  await openChannel(page)

  await fileInput(page).setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('план на неделю'),
  })
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Сообщение' }).fill('вот заметки')
  await page.getByRole('button', { name: 'Отправить' }).click()

  const download = page.getByRole('link', { name: 'Скачать notes.txt' })
  await expect(download).toBeVisible()
  const href = await download.getAttribute('href')
  expect(href).toContain('X-Amz-Signature')
  const file = await page.request.get(href ?? '')
  expect(file.ok()).toBe(true)
  expect(await file.text()).toBe('план на неделю')
})

test('a file over the limit is refused before it is sent', async ({ page }) => {
  await openChannel(page)
  const uploads: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/attachments')) {
      uploads.push(request.url())
    }
  })

  await fileInput(page).setInputFiles({
    name: 'big.bin',
    mimeType: 'application/octet-stream',
    buffer: Buffer.alloc(25 * 1024 * 1024 + 1),
  })

  await expect(page.getByRole('alert')).toHaveText('Файл больше 25 МБ — такой не загрузить.')
  expect(uploads).toEqual([])
})
