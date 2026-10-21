import { expect, test, type Page } from '@playwright/test'

import { createChannel, skipProfileOnboarding } from './helpers.ts'

const unique = () => `chat${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`
const password = 'a-long-enough-password'

async function openChannel(page: Page) {
  await page.goto('/register')
  await page.getByLabel('Ник').fill(unique())
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await skipProfileOnboarding(page)

  await page.getByRole('link', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill('Команда')
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('radio', { name: /Пустой/ }).check()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Создать сервер' }).click()

  await createChannel(page, 'общий')
}

async function send(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Сообщение' }).fill(text)
  await page.getByRole('button', { name: 'Отправить' }).click()
}

test('a message is sent, shown in order and survives a reload', async ({ page }) => {
  await openChannel(page)

  await expect(page.getByText('Здесь пока ничего не написано.')).toBeVisible()
  await send(page, 'первое')
  await expect(page.getByText('первое')).toBeVisible()
  await send(page, 'второе')
  await expect(page.getByText('второе')).toBeVisible()

  // The newest message is the last one in the log, before and after a reload.
  const order = async () => (await page.getByRole('log').innerText()).indexOf('первое')
  expect(await order()).toBeLessThan((await page.getByRole('log').innerText()).indexOf('второе'))

  await page.reload()
  await expect(page.getByText('второе')).toBeVisible()
  expect(await order()).toBeLessThan((await page.getByRole('log').innerText()).indexOf('второе'))
})

test('a message written offline is sent once when the network is back', async ({
  page,
  context,
}) => {
  await openChannel(page)

  await context.setOffline(true)
  await send(page, 'при обрыве')
  await expect(page.getByText('Нет сети — отправим, как только соединение вернётся.')).toBeVisible()
  await expect(page.getByText('при обрыве')).toHaveCount(0)

  await context.setOffline(false)
  await expect(page.getByText('при обрыве')).toHaveCount(1)

  // The send carried the client's own id, so the server kept one message.
  await page.reload()
  await expect(page.getByText('при обрыве')).toHaveCount(1)
})
