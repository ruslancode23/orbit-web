import { expect, test, type Page } from '@playwright/test'

import { createChannel, inviteLink, password, unique } from './helpers.ts'

async function register(page: Page, nickname: string): Promise<void> {
  await page.goto('/register')
  await page.getByLabel('Ник').fill(nickname)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await expect(page.getByText(nickname, { exact: true })).toBeVisible()
}

async function createServer(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill(unique('Личная команда'))
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('radio', { name: /Пустой/ }).check()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Создать сервер' }).click()
  await createChannel(page, 'общий')
}

async function joinServer(page: Page, link: string): Promise<void> {
  await page.goto(link)
  await page.getByRole('button', { name: 'Вступить на сервер' }).click()
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]+$/)
  await page.getByRole('link', { name: '# общий' }).click()
  await expect(page.getByRole('heading', { name: '# общий', level: 1 })).toBeVisible()
}

test('two people talk in a direct dialogue, live and with the unread badge', async ({
  browser,
}) => {
  const ownerName = unique('anna')
  const peerName = unique('bob')
  const ownerContext = await browser.newContext()
  const peerContext = await browser.newContext()
  const owner = await ownerContext.newPage()
  const peer = await peerContext.newPage()
  await register(owner, ownerName)
  await createServer(owner)
  const link = await inviteLink(owner)
  await owner.getByRole('button', { name: 'Закрыть' }).click()

  await register(peer, peerName)
  await joinServer(peer, link)

  // The owner opens the pair dialogue from the member card and writes first.
  await owner.getByRole('button', { name: peerName, exact: true }).click()
  await owner.getByRole('button', { name: 'Написать' }).click()
  await expect(owner).toHaveURL(/\/me\/[0-9a-f-]+$/)

  const first = unique('привет')
  await owner.getByRole('textbox', { name: 'Сообщение' }).fill(first)
  await owner.getByRole('button', { name: 'Отправить' }).click()
  await expect(owner.getByRole('region', { name: 'Чат' }).getByText(first)).toBeVisible()

  // The peer was never told to reload: the rail leads to the new dialogue and
  // the live message left an unread badge on its row.
  await peer.getByRole('link', { name: 'Личные сообщения' }).click()
  await expect(peer).toHaveURL(/\/me$/)
  const row = peer.getByRole('link', { name: new RegExp(ownerName) })
  await expect(row).toBeVisible()
  await expect(row).toHaveAttribute('aria-label', new RegExp('1 непрочитанное'))
  await expect(row).toContainText(first)

  await row.click()
  await expect(peer.getByRole('region', { name: 'Чат' }).getByText(first)).toBeVisible()
  await expect(peer.getByRole('link', { name: new RegExp(ownerName) })).not.toHaveAttribute(
    'aria-label',
    /непрочитан/,
  )

  // The answer appears in the open dialogue on the other side in under a second.
  const reply = unique('ответ')
  await peer.getByRole('textbox', { name: 'Сообщение' }).fill(reply)
  await peer.getByRole('button', { name: 'Отправить' }).click()
  await expect(owner.getByRole('region', { name: 'Чат' }).getByText(reply)).toBeVisible({
    timeout: 2000,
  })

  // The list preview follows the newest message, so the row says what it says.
  await expect(peer.getByRole('link', { name: new RegExp(ownerName) })).toContainText(reply)

  await ownerContext.close()
  await peerContext.close()
})
