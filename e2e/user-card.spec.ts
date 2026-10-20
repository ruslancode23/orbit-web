import { expect, test, type Page } from '@playwright/test'

import { createChannel, memberCard, password, unique } from './helpers.ts'

async function openWorkspace(page: Page, nickname: string): Promise<void> {
  await page.goto('/register')
  await page.getByLabel('Ник').fill(nickname)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await expect(page.getByRole('region', { name: 'Пользователь' })).toContainText(nickname)

  await page.getByRole('link', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill(unique('Карточки'))
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('radio', { name: /Пустой/ }).check()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Создать сервер' }).click()

  await createChannel(page, 'общий')
}

test('opens the profile card from the feed and the member column, and Esc closes it', async ({
  page,
}) => {
  const nickname = unique('card')
  await openWorkspace(page, nickname)

  await page.getByRole('textbox', { name: 'Сообщение' }).fill('привет')
  await page.getByRole('button', { name: 'Отправить' }).click()

  // Both the author's picture and name in the feed are real buttons with the card behind them.
  const feedTriggers = page.getByRole('log').getByRole('button', { name: nickname, exact: true })
  await expect(feedTriggers).toHaveCount(2)

  const avatarTrigger = feedTriggers.first()
  await avatarTrigger.click()

  const feedCard = page.getByRole('dialog', { name: `Карточка ${nickname}` })
  await expect(feedCard).toBeVisible()
  await expect(feedCard.getByText(`@${nickname}`)).toBeVisible()
  await expect(feedCard.getByRole('button', { name: 'Редактировать профиль' })).toBeVisible()

  // Esc closes the card and returns focus to the name that opened it.
  await page.keyboard.press('Escape')
  await expect(feedCard).toBeHidden()
  await expect(avatarTrigger).toBeFocused()

  // The name opens the same card, and focus comes back to the name.
  const nameTrigger = feedTriggers.last()
  await nameTrigger.click()
  await expect(feedCard).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(feedCard).toBeHidden()
  await expect(nameTrigger).toBeFocused()

  // The same card opens from the member column.
  const memberTrigger = memberCard(page, nickname)
  await memberTrigger.click()
  const memberCardDialog = page.getByRole('dialog', { name: `Карточка ${nickname}` })
  await expect(memberCardDialog).toBeVisible()
  await expect(memberCardDialog.getByText(`@${nickname}`)).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(memberCardDialog).toBeHidden()
  await expect(memberTrigger).toBeFocused()
})
