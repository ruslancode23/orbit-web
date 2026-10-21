import { expect, test, type Page } from '@playwright/test'

import {
  createChannel,
  memberCard,
  password,
  unique,
  userPanel,
  skipProfileOnboarding,
} from './helpers.ts'

/** Registers a fresh account, makes a server and opens its first text channel. */
async function openWorkspace(page: Page, nickname: string): Promise<void> {
  await page.goto('/register')
  await page.getByLabel('Ник').fill(nickname)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await skipProfileOnboarding(page)
  await expect(userPanel(page)).toContainText(nickname)

  await page.getByRole('link', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill(unique('Профиль'))
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('radio', { name: /Пустой/ }).check()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Создать сервер' }).click()

  await createChannel(page, 'общий')
}

async function openProfileTab(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Настройки пользователя' }).click()
  await page.getByRole('tab', { name: 'Профиль' }).click()
  await expect(page.getByRole('form', { name: 'Профиль' })).toBeVisible()
}

test('an uploaded avatar is shown in the feed', async ({ page }) => {
  const nickname = unique('avatar')
  await openWorkspace(page, nickname)
  await openProfileTab(page)

  await page.getByLabel('Файл аватара').setInputFiles('e2e/fixtures/avatar.png')
  const cropper = page.getByRole('dialog', { name: 'Обрезка аватара' })
  await expect(cropper).toBeVisible()
  await cropper.getByRole('button', { name: 'Применить' }).click()
  await expect(cropper).toBeHidden()

  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByText('Профиль сохранён', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Закрыть' }).click()
  await expect(page.getByRole('dialog', { name: 'Настройки пользователя' })).toBeHidden()

  await page.getByRole('textbox', { name: 'Сообщение' }).fill('с аватаром')
  await page.getByRole('button', { name: 'Отправить' }).click()

  const message = page.getByRole('log').locator('article').filter({ hasText: 'с аватаром' })
  await expect(message).toBeVisible()
  const avatar = message.locator('img')
  await expect(avatar).toBeVisible()
  await expect(avatar).toHaveAttribute('src', /.+/)
})

test('a new display name is shown in the member column', async ({ page }) => {
  const nickname = unique('display')
  const displayName = unique('Анна')
  await openWorkspace(page, nickname)

  const members = page.getByRole('complementary', { name: 'Участники' })
  await expect(memberCard(page, nickname)).toBeVisible()

  await openProfileTab(page)
  await page.getByLabel('Отображаемое имя').fill(displayName)
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByText('Профиль сохранён', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Закрыть' }).click()
  await expect(page.getByRole('dialog', { name: 'Настройки пользователя' })).toBeHidden()

  await expect(members.getByText(displayName, { exact: true })).toBeVisible()
  await expect(memberCard(page, displayName)).toBeVisible()
  await expect(userPanel(page).getByText(displayName, { exact: true })).toBeVisible()
})
