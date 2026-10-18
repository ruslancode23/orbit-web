import { expect, test } from '@playwright/test'

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

  await expect(page.getByText(`Вы вошли как ${nickname}`)).toBeVisible()

  // The session lives in a cookie, so it survives a reload.
  await page.reload()
  await expect(page.getByText(`Вы вошли как ${nickname}`)).toBeVisible()

  await page.getByRole('button', { name: 'Выйти' }).click()
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
  await expect(page.getByText(`Вы вошли как ${nickname}`)).toBeVisible()
  await page.getByRole('button', { name: 'Выйти' }).click()

  await page.getByLabel('Ник или email').fill(nickname)
  await page.getByLabel('Пароль').fill('not-my-password')
  await page.getByRole('button', { name: 'Войти' }).click()

  await expect(page.getByRole('alert')).toHaveText('Неверный логин или пароль.')
  await expect(page).toHaveURL(/\/login$/)

  // The right one gets in.
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByText(`Вы вошли как ${nickname}`)).toBeVisible()
})

test('a taken nickname is refused', async ({ page }) => {
  const nickname = unique()
  await page.goto('/register')
  await page.getByLabel('Ник').fill(nickname)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await expect(page.getByText(`Вы вошли как ${nickname}`)).toBeVisible()
  await page.getByRole('button', { name: 'Выйти' }).click()

  await page.goto('/register')
  await page.getByLabel('Ник').fill(nickname)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()

  await expect(page.getByRole('alert')).toContainText('уже заняты')
})
