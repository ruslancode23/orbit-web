import { expect, test, type Page } from '@playwright/test'

const unique = () => `actions${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`
const password = 'a-long-enough-password'

async function openChannel(page: Page) {
  await page.goto('/register')
  await page.getByLabel('Ник').fill(unique())
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()

  await page.getByRole('button', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill('Команда')
  await page.getByRole('button', { name: 'Создать', exact: true }).click()

  await page.getByRole('button', { name: '+ Канал' }).click()
  await page.getByLabel('Название канала').fill('общий')
  await page.getByRole('button', { name: 'Создать', exact: true }).click()
  await expect(page.getByRole('heading', { name: '# общий', level: 1 })).toBeVisible()
}

async function send(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Сообщение' }).fill(text)
  await page.getByRole('button', { name: 'Отправить' }).click()
}

test('a message can be answered, reacted to, edited and deleted', async ({ page }) => {
  await openChannel(page)

  await send(page, 'клюква')
  await send(page, 'второе')
  await expect(page.getByText('клюква', { exact: true })).toBeVisible()

  // The oldest article holds "клюква"; later ones may quote it in a reply.
  const originalId = await page
    .locator('article')
    .filter({ hasText: 'клюква' })
    .first()
    .getAttribute('data-message-id')
  if (originalId === null) {
    throw new Error('the sent message has no id')
  }
  const original = page.locator(`article[data-message-id="${originalId}"]`)

  // Reply: the composer names the message, and the sent one links back to it.
  await original.hover()
  await original.getByRole('button', { name: 'Ответить' }).click()
  await expect(page.getByText(/Ответ на сообщение/)).toBeVisible()
  await send(page, 'согласен')

  const reply = page.locator('article').filter({ hasText: 'согласен' })
  await expect(reply).toBeVisible()
  const jump = reply.getByRole('button', { name: /Перейти к сообщению от/ })
  await expect(jump).toBeVisible()
  await jump.click()

  // Reaction: the chip appears and the history is not reloaded with a jump.
  await original.hover()
  await original.getByRole('button', { name: 'Добавить реакцию' }).click()
  await page.getByRole('button', { name: 'Поставить реакцию 👍' }).click()
  await expect(original.getByRole('button', { name: /👍, 1 реакция, вы поставили/ })).toBeVisible()

  // Edit: only the author sees the button, and the new text stays after a reload.
  await original.hover()
  await original.getByRole('button', { name: 'Изменить' }).click()
  const editor = page.getByRole('textbox', { name: 'Редактировать сообщение' })
  await editor.fill('клюква поправлена')
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByText('клюква поправлена').first()).toBeVisible()
  await expect(page.getByText('(изменено)')).toBeVisible()

  await page.reload()
  await expect(page.getByText('клюква поправлена').first()).toBeVisible()

  // Delete asks first, then leaves a tombstone that replies can still point at.
  await original.hover()
  await original.getByRole('button', { name: 'Удалить' }).click()
  await expect(page.getByText('Удалить сообщение?')).toBeVisible()
  await page
    .getByRole('group', { name: 'Подтверждение удаления' })
    .getByRole('button', { name: 'Удалить' })
    .click()

  await expect(original.getByText('Сообщение удалено')).toBeVisible()
  // The reply still points at the tombstone instead of losing its anchor.
  await expect(reply.getByText('Сообщение удалено')).toBeVisible()
})
