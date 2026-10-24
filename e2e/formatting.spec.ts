import { expect, test } from '@playwright/test'

import { password, skipProfileOnboarding, unique } from './helpers.ts'

test('formats a message, links a URL and hides a spoiler', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Ник').fill(unique('формат'))
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await skipProfileOnboarding(page)

  await page.getByRole('link', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill(`Формат ${String(Date.now())}`)
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('radio', { name: /Пустой/ }).check()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Создать сервер' }).click()

  await page.getByRole('button', { name: 'Меню сервера' }).click()
  await page.getByRole('menuitem', { name: 'Создать канал' }).click()
  await page.getByLabel('Название канала').fill('формат')
  await page.getByRole('button', { name: 'Создать', exact: true }).click()
  await expect(page.getByRole('heading', { name: '# формат', level: 1 })).toBeVisible()

  const field = page.getByRole('textbox', { name: 'Сообщение' })
  await field.fill('**жирный** *курсив* https://example.com и ||тайна||')
  await field.press('Enter')

  const article = page.locator('[data-message-id]').last()
  await expect(article.getByText('жирный')).toHaveJSProperty('tagName', 'STRONG')
  await expect(article.getByText('курсив')).toHaveJSProperty('tagName', 'EM')
  const link = article.getByRole('link', { name: 'https://example.com' })
  await expect(link).toHaveAttribute('href', 'https://example.com')
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(article.getByText('тайна')).toHaveCount(0)
  await article.getByRole('button', { name: 'Показать спойлер' }).click()
  await expect(article.getByText('тайна')).toBeVisible()
})

test('wraps the selected text with a shortcut in the composer', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel('Ник').fill(unique('шорткат'))
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await skipProfileOnboarding(page)

  await page.getByRole('link', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill(`Шорткат ${String(Date.now())}`)
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('radio', { name: /Пустой/ }).check()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Создать сервер' }).click()

  await page.getByRole('button', { name: 'Меню сервера' }).click()
  await page.getByRole('menuitem', { name: 'Создать канал' }).click()
  await page.getByLabel('Название канала').fill('шорткаты')
  await page.getByRole('button', { name: 'Создать', exact: true }).click()

  const field = page.getByRole('textbox', { name: 'Сообщение' })
  await field.fill('жирный')
  await field.evaluate((element) => {
    if (element instanceof HTMLTextAreaElement) {
      element.setSelectionRange(0, element.value.length)
    }
  })
  await page.keyboard.press('ControlOrMeta+b')
  await expect(field).toHaveValue('**жирный**')
})
