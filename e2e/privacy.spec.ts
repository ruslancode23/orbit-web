import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test'

import {
  createChannel,
  inviteLink,
  memberCard,
  password,
  skipProfileOnboarding,
  unique,
} from './helpers.ts'

const API_URL = process.env.VITE_API_URL ?? 'http://localhost:8080'

async function post<T>(api: APIRequestContext, path: string, data?: object): Promise<T> {
  const response = await api.post(`${API_URL}/api/v1${path}`, data ? { data } : {})
  expect(response.ok(), `${path} answered ${String(response.status())}`).toBe(true)
  return (await response.json()) as T
}

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
  await page.getByLabel('Название сервера').fill(unique('Приватность'))
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

test('privacy closes a dialogue for a stranger and shows the state of a block', async ({
  browser,
}) => {
  test.setTimeout(150_000)
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

  // The owner closes new dialogues for everyone. The choice saves immediately.
  await owner.getByRole('button', { name: 'Настройки пользователя' }).click()
  await owner.getByRole('tab', { name: 'Приватность' }).click()
  const dmPolicy = owner.getByRole('group', { name: 'Кто может мне писать' })
  await expect(dmPolicy.getByRole('radio', { name: /^Люди с общих серверов/ })).toBeChecked()
  await dmPolicy.getByRole('radio', { name: /^Никто/ }).click()
  await expect(owner.getByText('Кто может мне писать: сохранено')).toBeVisible()
  await owner
    .getByRole('dialog', { name: 'Настройки пользователя' })
    .getByRole('button', {
      name: 'Закрыть',
    })
    .click()

  // A person from a common server cannot start a dialogue any more. The server
  // answers 404, and the screen says the person limited messages instead of
  // calling it a network failure.
  await memberCard(peer, ownerName).click()
  const ownerCard = peer.getByRole('dialog', { name: `Карточка ${ownerName}` })
  await ownerCard.getByRole('button', { name: 'Написать' }).click()
  await expect(peer.getByText('Этому человеку нельзя написать.')).toBeVisible()
  await expect(peer).not.toHaveURL(/\/me\//)
  await peer.keyboard.press('Escape')

  // The owner may still write first. The card of the peer offers a block; once
  // the server confirms it, the composer turns into the readable block state.
  await memberCard(owner, peerName).click()
  await owner
    .getByRole('dialog', { name: `Карточка ${peerName}` })
    .getByRole('button', {
      name: 'Написать',
    })
    .click()
  await expect(owner).toHaveURL(/\/me\/[0-9a-f-]+$/)

  const dialogue = owner.getByRole('region', { name: 'Диалог' })
  await dialogue.getByRole('button', { name: peerName, exact: true }).first().click()
  const peerCard = owner.getByRole('dialog', { name: `Карточка ${peerName}` })
  await peerCard.getByRole('button', { name: `Ещё: ${peerName}` }).click()
  await owner.getByRole('menuitem', { name: 'Заблокировать' }).click()
  await expect(peerCard).toBeHidden()

  await expect(owner.getByText('Вы заблокировали пользователя')).toBeVisible()
  await expect(owner.getByRole('button', { name: 'Разблокировать' })).toBeVisible()
  await expect(owner.getByRole('textbox', { name: 'Сообщение' })).toHaveCount(0)

  await owner.getByRole('button', { name: 'Разблокировать' }).click()
  await expect(owner.getByRole('textbox', { name: 'Сообщение' })).toBeVisible()
  await expect(owner.getByText('Вы заблокировали пользователя')).toHaveCount(0)

  await ownerContext.close()
  await peerContext.close()
})

test('a message from a blocked author stays folded in a group until shown', async ({ browser }) => {
  const ownerContext = await browser.newContext()
  await post<{ id: string }>(ownerContext.request, '/auth/register', {
    nickname: unique('anna'),
    password,
  })
  const authorApi = await request.newContext()
  const author = await post<{ id: string }>(authorApi, '/auth/register', {
    nickname: unique('bob'),
    password,
  })
  // Three people make a group; a pair would be a direct dialogue.
  const carolApi = await request.newContext()
  const carol = await post<{ id: string }>(carolApi, '/auth/register', {
    nickname: unique('carol'),
    password,
  })

  const group = await post<{ id: string }>(ownerContext.request, '/conversations', {
    userIds: [author.id, carol.id],
  })
  const blocked = await ownerContext.request.put(`${API_URL}/api/v1/users/me/blocks/${author.id}`)
  expect(blocked.ok(), `block answered ${String(blocked.status())}`).toBe(true)

  // The block stops a direct dialogue, not the shared group: the author writes,
  // and the server marks the message for the person who blocked them.
  const secret = unique('скрытое сообщение')
  await post(authorApi, `/channels/${group.id}/messages`, {
    clientMessageId: crypto.randomUUID(),
    content: secret,
  })

  const page = await ownerContext.newPage()
  await page.goto(`/me/${group.id}`)
  await skipProfileOnboarding(page)
  await expect(page.getByRole('heading', { name: 'Групповой чат', level: 1 })).toBeVisible()

  const chat = page.getByRole('region', { name: 'Чат' })
  const toggle = chat.getByRole('button', {
    name: /Сообщение от заблокированного пользователя/,
  })
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(chat.getByText(secret)).toHaveCount(0)

  await toggle.click()

  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(chat.getByText(secret)).toBeVisible()

  await ownerContext.close()
  await authorApi.dispose()
  await carolApi.dispose()
})
