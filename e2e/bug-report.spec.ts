import { expect, test } from '@playwright/test'

import { password, skipProfileOnboarding, unique, userPanel } from './helpers.ts'

test('a problem is reported from the user menu with a screenshot', async ({ page }) => {
  const nickname = unique('bug')
  await page.goto('/register')
  await page.getByLabel('Ник').fill(nickname)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await skipProfileOnboarding(page)
  await expect(userPanel(page)).toContainText(nickname)

  await userPanel(page)
    .getByRole('button', { name: new RegExp(nickname) })
    .click()
  await page.getByRole('menuitem', { name: 'Сообщить о проблеме' }).click()

  const dialog = page.getByRole('dialog', { name: 'Сообщить о проблеме' })
  await expect(dialog).toBeVisible()
  // The context that goes with the text is shown before it is sent.
  await expect(dialog.getByText('Страница: /')).toBeVisible()

  await dialog.getByRole('button', { name: 'Отправить' }).click()
  await expect(dialog.getByText(/Опишите, что случилось/)).toBeVisible()

  await dialog.getByLabel('Что случилось').fill('Смоук: отчёт о проблеме из e2e')
  await dialog.getByLabel('Как повторить').fill('Открыть меню и отправить отчёт')
  await dialog.getByLabel('Файл скриншота').setInputFiles('e2e/fixtures/avatar.png')
  await expect(dialog.getByText(/avatar\.png/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Отправить' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByText(/Отчёт № [0-9a-f]{8} отправлен/)).toBeVisible()
})
