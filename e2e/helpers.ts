import { expect, type Page } from '@playwright/test'

export const password = 'a-long-enough-password'

export const unique = (prefix: string) =>
  `${prefix}${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`

/** Creates a channel from the server menu and waits until it is open or in the rail. */
export async function createChannel(
  page: Page,
  name: string,
  kind: 'text' | 'voice' = 'text',
): Promise<void> {
  await page.getByRole('button', { name: 'Меню сервера' }).click()
  await page.getByRole('menuitem', { name: 'Создать канал' }).click()
  if (kind === 'voice') {
    await page.getByLabel('Тип канала').selectOption('voice')
  }
  await page.getByLabel('Название канала').fill(name)
  await page.getByRole('button', { name: 'Создать', exact: true }).click()
  if (kind === 'text') {
    await expect(page.getByRole('heading', { name: `# ${name}`, level: 1 })).toBeVisible()
  } else {
    await expect(page.getByRole('button', { name: `Голосовой канал ${name}` })).toBeVisible()
  }
}

/** Opens the invite dialog from the channel header, or from the server menu without one. */
export async function inviteLink(page: Page): Promise<string> {
  const headerButton = page.getByRole('main').getByRole('button', { name: 'Пригласить людей' })
  if ((await headerButton.count()) > 0) {
    await headerButton.first().click()
  } else {
    await page.getByRole('button', { name: 'Меню сервера' }).click()
    await page.getByRole('menuitem', { name: 'Пригласить людей' }).click()
  }
  await page.getByRole('button', { name: 'Создать ссылку' }).click()
  const field = page.getByLabel('Ссылка-приглашение')
  await expect(field).toBeVisible()
  return field.inputValue()
}

/** Signs out through the user settings dialog, where the action lives now. */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Настройки пользователя' }).click()
  await page.getByRole('tab', { name: 'Аккаунт' }).click()
  await page.getByRole('button', { name: 'Выйти' }).click()
}

export async function openServerSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Меню сервера' }).click()
  await page.getByRole('menuitem', { name: 'Настройки сервера' }).click()
}

/** The user panel at the bottom of the channel column. */
export const userPanel = (page: Page) => page.getByRole('region', { name: 'Пользователь' })

/**
 * The clickable person row in the member column. Its accessible name also
 * carries the presence label («В сети …»), so match the person's name, not the
 * whole string.
 */
export const memberCard = (page: Page, name: string) =>
  page
    .getByRole('complementary', { name: 'Участники' })
    .getByRole('button', { name: new RegExp(name) })

/**
 * The first-run «Заполните профиль» step opens over the shell for every fresh
 * account. Tests that are not about it put it away at once, as a person would.
 */
export async function skipProfileOnboarding(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Заполните профиль' })
  try {
    await dialog.waitFor({ state: 'visible', timeout: 2000 })
  } catch {
    return
  }
  await dialog.getByRole('button', { name: 'Пропустить' }).click()
  await expect(dialog).toBeHidden()
}
