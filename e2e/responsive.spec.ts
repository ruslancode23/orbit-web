import { expect, test } from '@playwright/test'

import { createChannel, password, unique } from './helpers.ts'

test('a narrow screen keeps the chat and slides the channels and members in', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 720 })
  await page.goto('/register')
  await page.getByLabel('Ник').fill(unique('narrow'))
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()

  await page.getByRole('link', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill('Команда')
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('radio', { name: /Пустой/ }).check()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Создать сервер' }).click()

  const channels = page.getByRole('complementary', { name: 'Каналы' })
  await expect(channels).toBeHidden()

  // The channel is made from the drawer, which then gets out of the way.
  await page.getByRole('button', { name: 'Каналы' }).click()
  await expect(channels).toBeVisible()
  await page.getByRole('button', { name: 'Меню сервера' }).click()
  await page.getByRole('menuitem', { name: 'Создать канал' }).click()
  await page.getByLabel('Название канала').fill('общий')
  await page.getByRole('button', { name: 'Создать', exact: true }).click()
  await expect(page.getByRole('heading', { name: '# общий', level: 1 })).toBeVisible()
  await expect(channels).toBeHidden()

  // The chat is the whole width until the members are asked for.
  const members = page.getByRole('complementary', { name: 'Участники' })
  await expect(members).toBeHidden()
  await page.getByRole('button', { name: 'Участники' }).click()
  await expect(members).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(members).toBeHidden()

  // Opening the drawer again and picking the channel closes it.
  await page.getByRole('button', { name: 'Каналы' }).click()
  await expect(channels).toBeVisible()
  await page.getByRole('link', { name: '# общий' }).click()
  await expect(channels).toBeHidden()

  // A new channel from the drawer is created and opened, too.
  await page.getByRole('button', { name: 'Каналы' }).click()
  await createChannel(page, 'флуд')
  await expect(page.getByRole('heading', { name: '# флуд', level: 1 })).toBeVisible()
})
