import { expect, test, type Page } from '@playwright/test'

import {
  createChannel,
  inviteLink,
  password,
  unique,
  userPanel,
  skipProfileOnboarding,
} from './helpers.ts'

async function openServer(page: Page) {
  await page.goto('/register')
  await page.getByLabel('Ник').fill(unique('owner'))
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

test('an invite link brings a guest in, and the guest can keep the account', async ({
  page,
  browser,
}) => {
  await openServer(page)
  const link = await inviteLink(page)
  expect(link).toContain('/invite/')

  // The owner following their own link is already a member: one button, no form.
  await page.goto(link)
  await expect(page.getByText(/Вы вошли как/)).toBeVisible()
  await page.getByRole('button', { name: 'Вступить на сервер' }).click()
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]+$/)

  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  const guestName = unique('Гость')

  await guestPage.goto(link)
  await expect(guestPage.getByRole('heading', { name: 'Команда' })).toBeVisible()
  await guestPage.getByLabel('Ваше имя').fill(guestName)
  await guestPage.getByRole('button', { name: 'Войти как гость' }).click()

  await expect(guestPage).toHaveURL(/\/s\/[0-9a-f-]+$/)
  await expect(userPanel(guestPage).getByText(guestName, { exact: true })).toBeVisible()
  await expect(userPanel(guestPage).getByText('гость', { exact: true })).toBeVisible()
  await guestPage.getByRole('link', { name: '# общий' }).click()
  await expect(guestPage.getByRole('textbox', { name: 'Сообщение' })).toBeVisible()

  // The guest keeps its place and its history by turning the account into a full one.
  await guestPage.getByRole('button', { name: 'Настройки пользователя' }).click()
  await guestPage.getByRole('tab', { name: 'Аккаунт' }).click()
  await guestPage.getByRole('button', { name: 'Создать аккаунт' }).click()
  await guestPage.getByLabel('Пароль').fill(password)
  await guestPage.getByRole('button', { name: 'Создать аккаунт' }).click()
  // Claiming closes the settings and opens the one-time profile step.
  await skipProfileOnboarding(guestPage)

  await expect(userPanel(guestPage).getByText(guestName, { exact: true })).toBeVisible()
  await expect(userPanel(guestPage).getByText('гость', { exact: true })).toHaveCount(0)

  // The account is a full one now, and the step does not come back.
  await guestPage.getByRole('button', { name: 'Настройки пользователя' }).click()
  await guestPage.getByRole('tab', { name: 'Аккаунт' }).click()
  await expect(guestPage.getByText('Полный аккаунт')).toBeVisible()
  await guestPage.keyboard.press('Escape')

  await guestContext.close()
})

test('a revoked link no longer lets anyone in', async ({ page, browser }) => {
  await openServer(page)
  const link = await inviteLink(page)

  // The panel lists the link it just made; revoking it kills the link at once.
  await page.getByRole('button', { name: /Отозвать приглашение/ }).click()
  await expect(page.getByText('Ссылок пока нет.')).toBeVisible()

  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto(link)

  await expect(
    guestPage.getByRole('heading', { name: 'Приглашение недействительно' }),
  ).toBeVisible()

  await guestContext.close()
})
