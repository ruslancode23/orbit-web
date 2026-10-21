import { expect, test } from '@playwright/test'

import { signOut, skipProfileOnboarding } from './helpers.ts'

// The server is shared with the other specs, so every account here gets a name
// of its own instead of relying on a clean database.
const unique = () => `e2e${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`
const password = 'a-long-enough-password'

test('a page that needs an account sends you to sign in', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible()
})

test('register, stay signed in across a reload, sign out', async ({ page }) => {
  const nickname = unique()

  await page.goto('/register')
  await page.getByLabel('Ник').fill(nickname)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await skipProfileOnboarding(page)

  // The shell greets a fresh account with no servers yet, and names it in the sidebar.
  await expect(page.getByText('Создайте свой первый сервер')).toBeVisible()
  await expect(page.getByText(nickname, { exact: true })).toBeVisible()

  // The session lives in a cookie, so it survives a reload.
  await page.reload()
  await expect(page.getByText(nickname, { exact: true })).toBeVisible()

  await signOut(page)
  await expect(page).toHaveURL(/\/login$/)

  // And it is really gone: the guarded page sends us back.
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
})

test('a wrong password says so without saying which half was wrong', async ({ page }) => {
  const nickname = unique()
  await page.goto('/register')
  await page.getByLabel('Ник').fill(nickname)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await skipProfileOnboarding(page)
  await expect(page.getByText(nickname, { exact: true })).toBeVisible()
  await signOut(page)

  await page.getByLabel('Ник или email').fill(nickname)
  await page.getByLabel('Пароль').fill('not-my-password')
  await page.getByRole('button', { name: 'Войти' }).click()

  await expect(page.getByRole('alert')).toHaveText('Неверный логин или пароль.')
  await expect(page).toHaveURL(/\/login$/)

  // The right one gets in.
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByText(nickname, { exact: true })).toBeVisible()
})

test('a taken nickname is refused', async ({ page }) => {
  const nickname = unique()
  await page.goto('/register')
  await page.getByLabel('Ник').fill(nickname)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await skipProfileOnboarding(page)
  await expect(page.getByText(nickname, { exact: true })).toBeVisible()
  await signOut(page)

  await page.goto('/register')
  await page.getByLabel('Ник').fill(nickname)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await skipProfileOnboarding(page)

  await expect(page.getByRole('alert')).toContainText('уже заняты')
})
