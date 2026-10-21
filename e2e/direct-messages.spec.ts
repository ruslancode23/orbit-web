import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test'

import {
  createChannel,
  inviteLink,
  memberCard,
  password,
  unique,
  skipProfileOnboarding,
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
  await memberCard(owner, peerName).click()
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

  // Hiding is private and lasts until a new message: the dialogue goes out of
  // this account's list and comes back by itself when the peer writes again.
  await owner.getByRole('button', { name: 'Действия с беседой' }).click()
  await owner.getByRole('menuitem', { name: 'Скрыть' }).click()
  await expect(owner.getByRole('link', { name: new RegExp(peerName) })).toHaveCount(0)

  const afterHiding = unique('после скрытия')
  await peer.getByRole('textbox', { name: 'Сообщение' }).fill(afterHiding)
  await peer.getByRole('button', { name: 'Отправить' }).click()
  await expect(owner.getByRole('link', { name: new RegExp(peerName) })).toBeVisible()
  await expect(owner.getByRole('link', { name: new RegExp(peerName) })).toContainText(afterHiding)

  await ownerContext.close()
  await peerContext.close()
})

// A group is made through the API: creating one from the interface is DM-5
// (SCRUM-87), still ahead. Renaming, adding people and leaving are what this
// scenario exercises, and the system lines are how the feed tells them.
test('a group is renamed, gains a member and is left with system lines', async ({ browser }) => {
  const ownerContext = await browser.newContext()
  const owner = await post<{ id: string; nickname: string }>(
    ownerContext.request,
    '/auth/register',
    { nickname: unique('anna'), password },
  )
  const bobApi = await request.newContext()
  const bob = await post<{ id: string }>(bobApi, '/auth/register', {
    nickname: unique('bob'),
    password,
  })
  const carolApi = await request.newContext()
  const carol = await post<{ id: string }>(carolApi, '/auth/register', {
    nickname: unique('carol'),
    password,
  })
  const group = await post<{ id: string }>(ownerContext.request, '/conversations', {
    userIds: [bob.id, carol.id],
  })

  // A friend is whom the «Добавить людей» dialog offers; a common server is
  // what the default friendship policy asks for first.
  const daveApi = await request.newContext()
  const dave = await post<{ id: string; nickname: string }>(daveApi, '/auth/register', {
    nickname: unique('dave'),
    password,
  })
  const workspace = await post<{ workspace: { id: string } }>(ownerContext.request, '/workspaces', {
    name: unique('Знакомые'),
  })
  const invite = await post<{ code: string }>(
    ownerContext.request,
    `/workspaces/${workspace.workspace.id}/invites`,
  )
  await post(daveApi, `/invites/${invite.code}/accept`)
  await post(ownerContext.request, '/friends/requests', { nickname: dave.nickname })
  await post(daveApi, `/friends/requests/${owner.id}/accept`)

  const page = await ownerContext.newPage()
  await page.goto('/me')
  await skipProfileOnboarding(page)

  await page.getByRole('link', { name: 'Групповой чат' }).click()
  await expect(page.getByRole('heading', { name: 'Групповой чат', level: 1 })).toBeVisible()

  // Rename: the title changes everywhere and the feed gets a system line.
  await page.getByRole('button', { name: 'Действия с группой' }).click()
  await page.getByRole('menuitem', { name: 'Переименовать' }).click()
  const rename = page.getByRole('dialog', { name: 'Переименовать группу' })
  await rename.getByLabel('Название группы').fill('Планы')
  await rename.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page.getByRole('heading', { name: 'Планы', level: 1 })).toBeVisible()
  await expect(page.getByRole('note', { name: /переименовал чат в «Планы»/ })).toBeVisible()

  // Add a friend: the server writes one system line per new member.
  await page.getByRole('button', { name: 'Добавить людей' }).click()
  const add = page.getByRole('dialog', { name: 'Добавить людей' })
  await add.getByRole('checkbox', { name: dave.nickname }).check()
  await add.getByRole('button', { name: 'Добавить' }).click()
  await expect(page.getByRole('note', { name: /добавил/ })).toBeVisible()

  // Leaving ends access: the dialogue goes from the list and its history is gone.
  await page.getByRole('button', { name: 'Действия с группой' }).click()
  await page.getByRole('menuitem', { name: 'Выйти из группы' }).click()
  const leave = page.getByRole('dialog', { name: 'Выйти из группы' })
  await leave.getByRole('button', { name: 'Выйти' }).click()
  await expect(page).toHaveURL(/\/me$/)
  await expect(page.getByRole('link', { name: 'Планы' })).toHaveCount(0)

  await page.goto(`/me/${group.id}`)
  await expect(page.getByRole('heading', { name: 'Диалог не найден' })).toBeVisible()

  await ownerContext.close()
  await bobApi.dispose()
  await carolApi.dispose()
  await daveApi.dispose()
})
