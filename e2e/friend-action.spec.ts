import { expect, test, type Page } from '@playwright/test'

import { createChannel, inviteLink, password, unique, skipProfileOnboarding } from './helpers.ts'

async function register(page: Page, nickname: string): Promise<void> {
  await page.goto('/register')
  await page.getByLabel('Ник').fill(nickname)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await skipProfileOnboarding(page)
  await expect(page.getByRole('region', { name: 'Пользователь' })).toContainText(nickname)
}

async function createServer(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill(unique('Заявки'))
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('radio', { name: /Пустой/ }).check()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Создать сервер' }).click()
}

async function joinServer(page: Page, link: string): Promise<void> {
  await page.goto(link)
  await page.getByRole('button', { name: 'Вступить на сервер' }).click()
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]+$/)
}

test('a request from the feed becomes a friendship for both live', async ({ browser }) => {
  const ownerName = unique('anna')
  const peerName = unique('bob')
  const ownerContext = await browser.newContext()
  const peerContext = await browser.newContext()
  const owner = await ownerContext.newPage()
  const peer = await peerContext.newPage()

  await register(owner, ownerName)
  await createServer(owner)
  await createChannel(owner, 'общий')
  const link = await inviteLink(owner)
  await owner.getByRole('button', { name: 'Закрыть' }).click()

  await register(peer, peerName)
  await joinServer(peer, link)
  await peer.getByRole('link', { name: '# общий' }).click()
  await peer.getByRole('textbox', { name: 'Сообщение' }).fill('привет')
  await peer.getByRole('button', { name: 'Отправить' }).click()
  await expect(peer.getByText('привет', { exact: true })).toBeVisible()

  // The owner opens the card of the message's author, from the feed.
  await owner.getByRole('link', { name: '# общий' }).click()
  await expect(owner.getByText('привет', { exact: true })).toBeVisible()
  await owner.getByRole('log').getByRole('button', { name: peerName, exact: true }).first().click()

  const card = owner.getByRole('dialog', { name: `Карточка ${peerName}` })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Добавить в друзья' }).click()
  await expect(card.getByText('Заявка отправлена')).toBeVisible()

  // The peer accepts in the friends section. The owner's card stays open and
  // changes by itself on the friend.added event.
  await peer.getByRole('link', { name: /Личные сообщения/ }).click()
  await expect(peer.getByRole('heading', { name: 'Друзья', level: 1 })).toBeVisible()
  const pending = peer.getByRole('tab', { name: /Ожидание/ })
  await expect(pending).toHaveAccessibleName('Ожидание, 1 входящая заявка')
  await pending.click()
  await peer.getByRole('button', { name: `Принять заявку от ${ownerName}` }).click()

  await expect(card.getByRole('button', { name: 'Друзья' })).toBeVisible({ timeout: 10_000 })

  await ownerContext.close()
  await peerContext.close()
})
