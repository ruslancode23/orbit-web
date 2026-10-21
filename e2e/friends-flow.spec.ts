import { expect, test, type Page } from '@playwright/test'

import { inviteLink, password, unique, skipProfileOnboarding } from './helpers.ts'

const NEUTRAL_ANSWER = 'Если такой пользователь есть, он получит заявку'

async function register(page: Page, nickname: string): Promise<void> {
  await page.goto('/register')
  await page.getByLabel('Ник').fill(nickname)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await skipProfileOnboarding(page)
  await expect(page.getByText(nickname, { exact: true })).toBeVisible()
}

async function createServer(page: Page): Promise<string> {
  const name = unique('Общие')
  await page.getByRole('link', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill(name)
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('radio', { name: /Пустой/ }).check()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Создать сервер' }).click()
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]+$/)
  return name
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
  // The personal stream is what brings a request in; wait for it to open.
  await expect(page.getByText('Подключаемся…')).toHaveCount(0)
}

async function sendFriendRequest(page: Page, nickname: string): Promise<void> {
  await page.getByRole('button', { name: 'Добавить в друзья' }).click()
  await page.getByLabel('Ник').fill(nickname)
  await page.getByRole('button', { name: 'Отправить заявку' }).click()
  await expect(page.getByText(NEUTRAL_ANSWER)).toBeVisible()
  await page.keyboard.press('Escape')
}

async function acceptFriendRequest(page: Page, from: string): Promise<void> {
  const pending = page.getByRole('tab', { name: /Ожидание/ })
  await expect(pending).toHaveAccessibleName('Ожидание, 1 входящая заявка')
  await pending.click()
  await page.getByRole('button', { name: `Принять заявку от ${from}` }).click()
}

test('a friendship goes from a nickname request to shared lists, a message and a block', async ({
  browser,
}) => {
  // Three accounts: the third one becomes the common friend the shared-list
  // tab can actually show (a friendship is not a friend of itself).
  test.setTimeout(150_000)
  const annaName = unique('anna')
  const bobName = unique('bob')
  const vikaName = unique('vika')
  const annaContext = await browser.newContext()
  const bobContext = await browser.newContext()
  const vikaContext = await browser.newContext()
  const anna = await annaContext.newPage()
  const bob = await bobContext.newPage()
  const vika = await vikaContext.newPage()

  await register(anna, annaName)
  const serverName = await createServer(anna)
  const link = await inviteLink(anna)
  await anna.getByRole('button', { name: 'Закрыть' }).click()

  await register(bob, bobName)
  await joinServer(bob, link)

  await register(vika, vikaName)
  await joinServer(vika, link)

  await openFriends(anna)
  await openFriends(bob)

  // Anna asks by exact handle; the answer says nothing about the account.
  await sendFriendRequest(anna, bobName)

  // Bob was never told to reload: the stream puts the request in «Ожидание».
  await acceptFriendRequest(bob, annaName)

  // Both now have each other in «Все» and, since both are connected, «В сети».
  await bob.getByRole('tab', { name: 'Все' }).click()
  await expect(bob.getByText(annaName, { exact: true })).toBeVisible()
  await bob.getByRole('tab', { name: 'В сети' }).click()
  await expect(bob.getByText(annaName, { exact: true })).toBeVisible({ timeout: 5000 })

  await anna.getByRole('tab', { name: 'Все' }).click()
  await expect(anna.getByText(bobName, { exact: true })).toBeVisible()
  await anna.getByRole('tab', { name: 'В сети' }).click()
  await expect(anna.getByText(bobName, { exact: true })).toBeVisible({ timeout: 5000 })

  // Vika joins the same server, so the default "people on a common server"
  // policy lets her ask both of them. She becomes the common friend.
  await openFriends(vika)
  await sendFriendRequest(vika, annaName)
  await sendFriendRequest(vika, bobName)
  await acceptFriendRequest(anna, vikaName)
  await acceptFriendRequest(bob, vikaName)

  // The full profile of Bob, opened from the friend row, carries the
  // intersection: the server both are on and the friend both have.
  await anna.getByRole('tab', { name: 'Все' }).click()
  await anna
    .getByRole('tabpanel')
    .getByRole('button', { name: bobName, exact: true })
    .first()
    .click()
  const bobCard = anna.getByRole('dialog', { name: `Карточка ${bobName}` })
  await bobCard.getByRole('button', { name: 'Открыть профиль' }).click()
  const bobProfile = anna.getByRole('dialog', { name: `Профиль ${bobName}` })

  await expect(bobProfile.getByRole('tab', { name: 'Общие серверы' })).toBeVisible()
  const sharedServer = bobProfile.getByRole('link', {
    name: `${serverName}, ваша роль: владелец`,
  })
  await expect(sharedServer).toBeVisible()
  await expect(sharedServer).toHaveAttribute('href', /\/s\/[0-9a-f-]+$/)
  await expect(sharedServer).toContainText('Ваша роль: владелец')

  await bobProfile.getByRole('tab', { name: 'Общие друзья' }).click()
  await expect(bobProfile.getByRole('button', { name: vikaName })).toBeVisible()

  // «Написать» opens the pair dialogue from the same full profile.
  await bobProfile.getByRole('button', { name: 'Написать' }).click()
  await expect(anna).toHaveURL(/\/me\/[0-9a-f-]+$/)
  const firstMessage = unique('привет')
  await anna.getByRole('textbox', { name: 'Сообщение' }).fill(firstMessage)
  await anna.getByRole('button', { name: 'Отправить' }).click()
  await expect(anna.getByRole('region', { name: 'Чат' }).getByText(firstMessage)).toBeVisible()

  // The message reaches Bob live, and the new dialogue is already in his list.
  const bobDialog = bob.getByRole('link', { name: new RegExp(annaName) })
  await expect(bobDialog).toBeVisible({ timeout: 5000 })
  await expect(bobDialog).toContainText(firstMessage)
  await bobDialog.click()
  await expect(bob.getByRole('region', { name: 'Чат' }).getByText(firstMessage)).toBeVisible()

  // The pair dialogue still has Bob's card in the header. Anna removes him
  // from the «Друзья» menu; the card stays open and offers adding him back.
  const dialogue = anna.getByRole('region', { name: 'Диалог' })
  await dialogue.getByRole('button', { name: bobName, exact: true }).first().click()
  const liveCard = anna.getByRole('dialog', { name: `Карточка ${bobName}` })
  await liveCard.getByRole('button', { name: 'Друзья', exact: true }).click()
  await anna.getByRole('menuitem', { name: 'Удалить из друзей' }).click()
  await expect(liveCard.getByRole('button', { name: 'Добавить в друзья' })).toBeVisible()
  await expect(liveCard.getByRole('button', { name: 'Друзья', exact: true })).toHaveCount(0)

  // Now he is no longer a friend, and blocking is still there — from the
  // overflow menu of the same card. The card closes once the server confirms.
  await liveCard.getByRole('button', { name: `Ещё: ${bobName}` }).click()
  await anna.getByRole('menuitem', { name: 'Заблокировать' }).click()
  await expect(liveCard).toBeHidden()

  await anna.getByRole('link', { name: 'Друзья', exact: true }).click()
  await anna.getByRole('tab', { name: 'Все' }).click()
  await expect(
    anna.getByRole('tabpanel').getByRole('button', { name: bobName, exact: true }),
  ).toHaveCount(0)
  await anna.getByRole('tab', { name: 'Заблокированные' }).click()
  await expect(anna.getByText(`@${bobName}`)).toBeVisible()

  // Bob still has the dialogue but no way back: a new request is accepted for
  // processing with the same neutral body and is never stored.
  await bob.getByRole('link', { name: 'Друзья', exact: true }).click()
  await sendFriendRequest(bob, annaName)
  await bob.getByRole('tab', { name: /Ожидание/ }).click()
  await expect(bob.getByText('Нет ожидающих заявок')).toBeVisible()

  // Anna's side confirms it as well: nothing arrived, even after a reload.
  await anna.reload()
  await expect(anna.getByRole('heading', { name: 'Друзья', level: 1 })).toBeVisible()
  const pending = anna.getByRole('tab', { name: 'Ожидание' })
  await expect(pending).toHaveAccessibleName('Ожидание')
  await pending.click()
  await expect(anna.getByText('Нет ожидающих заявок')).toBeVisible()

  await annaContext.close()
  await bobContext.close()
  await vikaContext.close()
})
