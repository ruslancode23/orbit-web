import { expect, test, type Page } from '@playwright/test'

import { createChannel, password, unique, userPanel } from './helpers.ts'

async function register(page: Page): Promise<string> {
  const nickname = unique('onboarding')
  await page.goto('/register')
  await page.getByLabel('Ник').fill(nickname)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  return nickname
}

const step = (page: Page) => page.getByRole('dialog', { name: 'Заполните профиль' })

test('the profile step is shown once and skipped for good', async ({ page }) => {
  const nickname = await register(page)

  // It waits for the fresh account, and closing it without an answer does not
  // mark anything: a reload brings it back because the server flag is still null.
  await expect(step(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(step(page)).toBeHidden()

  await page.reload()
  await expect(step(page)).toBeVisible()

  // «Пропустить» is always there and marks the step, so a reload keeps it away.
  await step(page).getByRole('button', { name: 'Пропустить' }).click()
  await expect(step(page)).toBeHidden()
  await expect(userPanel(page)).toContainText(nickname)

  await page.reload()
  await expect(userPanel(page)).toContainText(nickname)
  await expect(step(page)).toBeHidden()
})

test('saving the profile from the step also marks it', async ({ page }) => {
  await register(page)
  const displayName = unique('Анна')

  await expect(step(page)).toBeVisible()
  await step(page).getByLabel('Отображаемое имя').fill(displayName)
  await step(page).getByLabel('О себе').fill('Пишу код и пью кофе.')
  await step(page).getByRole('button', { name: 'Сохранить' }).click()

  await expect(step(page)).toBeHidden()
  await expect(userPanel(page).getByText(displayName, { exact: true })).toBeVisible()

  await page.reload()
  await expect(userPanel(page).getByText(displayName, { exact: true })).toBeVisible()
  await expect(step(page)).toBeHidden()
})

test('after the step the profile settings and a new server still work', async ({ page }) => {
  const nickname = await register(page)
  await expect(step(page)).toBeVisible()
  await step(page).getByRole('button', { name: 'Пропустить' }).click()
  await expect(step(page)).toBeHidden()

  await page.getByRole('button', { name: 'Настройки пользователя' }).click()
  await page.getByRole('tab', { name: 'Профиль' }).click()
  await expect(page.getByRole('form', { name: 'Профиль' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('link', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill(unique('Онбординг'))
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('radio', { name: /Пустой/ }).check()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Создать сервер' }).click()

  await createChannel(page, 'общий')
  await expect(userPanel(page)).toContainText(nickname)
})
