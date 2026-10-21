import { expect, test, type Page } from '@playwright/test'

import { inviteLink, password, unique, skipProfileOnboarding } from './helpers.ts'

async function register(page: Page, nickname: string): Promise<void> {
  await page.goto('/register')
  await page.getByLabel('Ник').fill(nickname)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await skipProfileOnboarding(page)
  await expect(page.getByText(nickname, { exact: true })).toBeVisible()
}

async function createServer(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill(unique('Друзья'))
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

async function openFriends(page: Page): Promise<void> {
  await page.getByRole('link', { name: /Личные сообщения/ }).click()
  await expect(page).toHaveURL(/\/me$/)
  await expect(page.getByRole('heading', { name: 'Друзья', level: 1 })).toBeVisible()
  // The personal stream is what brings the request in; wait for it to open.
  await expect(page.getByText('Подключаемся…')).toHaveCount(0)
}

test('two people become friends by nickname, live and without reloading', async ({ browser }) => {
  const ownerName = unique('anna')
  const peerName = unique('bob')
  const ownerContext = await browser.newContext()
  const peerContext = await browser.newContext()
  const owner = await ownerContext.newPage()
  const peer = await peerContext.newPage()

  // The default request policy is "people on a common server", so the owner
  // invites the peer before either of them knows the other.
  await register(owner, ownerName)
  await createServer(owner)
  const link = await inviteLink(owner)
  await owner.getByRole('button', { name: 'Закрыть' }).click()

  await register(peer, peerName)
  await joinServer(peer, link)

  await openFriends(owner)
  await openFriends(peer)

  // The owner asks by exact handle; the answer says nothing about the account.
  await owner.getByRole('button', { name: 'Добавить в друзья' }).click()
  await owner.getByLabel('Ник').fill(peerName)
  await owner.getByRole('button', { name: 'Отправить заявку' }).click()
  await expect(owner.getByText('Если такой пользователь есть, он получит заявку')).toBeVisible()
  await owner.keyboard.press('Escape')

  // The peer never reloads: the personal stream puts the request in
  // «Ожидание» and raises the incoming badge.
  const pending = peer.getByRole('tab', { name: /Ожидание/ })
  await expect(pending).toHaveAccessibleName('Ожидание, 1 входящая заявка')
  await pending.click()
  const accept = peer.getByRole('button', { name: `Принять заявку от ${ownerName}` })
  await expect(accept).toBeVisible()
  await accept.click()

  // The new friendship appears on both sides in «Все»...
  await peer.getByRole('tab', { name: 'Все' }).click()
  await expect(peer.getByText(ownerName, { exact: true })).toBeVisible()

  await owner.getByRole('tab', { name: 'Все' }).click()
  await expect(owner.getByText(peerName, { exact: true })).toBeVisible()

  // ...and both are reachable, so both see each other in «В сети» as well.
  await peer.getByRole('tab', { name: 'В сети' }).click()
  await expect(peer.getByText(ownerName, { exact: true })).toBeVisible({ timeout: 5000 })

  await owner.bringToFront()
  await owner.getByRole('tab', { name: 'В сети' }).click()
  await expect(owner.getByText(peerName, { exact: true })).toBeVisible({ timeout: 5000 })

  await ownerContext.close()
  await peerContext.close()
})
