import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

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

interface Account {
  id: string
  nickname: string
}

/** An account registered through the API, with its own cookie jar for the page. */
async function account(context: APIRequestContext) {
  return post<Account>(context, '/auth/register', { nickname: unique('user'), password })
}

/** A server with one text channel, created through the interface. */
async function createWorkspaceInUi(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill(unique('Команда'))
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('radio', { name: /Пустой/ }).check()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Создать сервер' }).click()
  await createChannel(page, 'общий')
}

/** Registers the people on one server, so the new-message dialog can find them. */
async function shareServer(
  owner: APIRequestContext,
  people: readonly { nickname: string; api: APIRequestContext }[],
): Promise<void> {
  const workspace = await post<{ workspace: { id: string } }>(owner, '/workspaces', {
    name: unique('Знакомые'),
  })
  const invite = await post<{ code: string }>(
    owner,
    `/workspaces/${workspace.workspace.id}/invites`,
  )
  for (const person of people) {
    await post(person.api, `/invites/${invite.code}/accept`)
  }
}

test('opens an existing pair dialogue from the member column', async ({ browser }) => {
  const ownerContext = await browser.newContext()
  await account(ownerContext.request)
  const ownerPage = await ownerContext.newPage()
  await ownerPage.goto('/me')
  await skipProfileOnboarding(ownerPage)
  await createWorkspaceInUi(ownerPage)

  const link = await inviteLink(ownerPage)
  await ownerPage.keyboard.press('Escape')
  const peerContext = await browser.newContext()
  const peer = await account(peerContext.request)
  const peerPage = await peerContext.newPage()
  await peerPage.goto(link)
  await peerPage.getByRole('button', { name: 'Вступить на сервер' }).click()
  await expect(peerPage).toHaveURL(/\/s\/[0-9a-f-]+$/)
  await skipProfileOnboarding(peerPage)
  await peerPage.getByRole('link', { name: '# общий' }).click()

  // The frame of the member column is the way into a personal dialogue.
  await memberCard(ownerPage, peer.nickname).click()
  await ownerPage.getByRole('button', { name: 'Написать' }).click()
  await expect(ownerPage).toHaveURL(/\/me\/[0-9a-f-]+$/)
  const dialogueUrl = ownerPage.url()
  await expect(ownerPage.getByRole('heading', { name: peer.nickname, level: 1 })).toBeVisible()

  // The same pair always has one dialogue: the second click opens it again.
  await ownerPage.goBack()
  await memberCard(ownerPage, peer.nickname).click()
  await ownerPage.getByRole('button', { name: 'Написать' }).click()
  await expect(ownerPage).toHaveURL(dialogueUrl)

  await ownerContext.close()
  await peerContext.close()
})

test('creates a group, renames it, adds a member and lets one participant leave', async ({
  browser,
}) => {
  const ownerContext = await browser.newContext()
  const owner = await account(ownerContext.request)
  const bobContext = await browser.newContext()
  const bob = await account(bobContext.request)
  const carolContext = await browser.newContext()
  const carol = await account(carolContext.request)
  const daveContext = await browser.newContext()
  const dave = await account(daveContext.request)

  await shareServer(ownerContext.request, [
    { nickname: bob.nickname, api: bobContext.request },
    { nickname: carol.nickname, api: carolContext.request },
    { nickname: dave.nickname, api: daveContext.request },
  ])
  // «Добавить людей» offers friends; a common server is what the policy needs.
  await post(ownerContext.request, '/friends/requests', { nickname: dave.nickname })
  await post(daveContext.request, `/friends/requests/${owner.id}/accept`)

  const ownerPage = await ownerContext.newPage()
  await ownerPage.goto('/me')
  await skipProfileOnboarding(ownerPage)

  await ownerPage.getByRole('button', { name: 'Новый диалог' }).click()
  const create = ownerPage.getByRole('dialog', { name: 'Новое сообщение' })
  await expect(create).toBeVisible()

  // One person is a dialogue, several are a group with an optional title.
  await create.getByRole('combobox', { name: 'Поиск людей' }).fill(bob.nickname)
  await create.getByRole('option', { name: new RegExp(bob.nickname) }).click()
  await create.getByRole('combobox', { name: 'Поиск людей' }).fill(carol.nickname)
  await create.getByRole('option', { name: new RegExp(carol.nickname) }).click()
  await expect(create.getByText('Выбрано 2 из 20.')).toBeVisible()

  const groupName = unique('Планы')
  await create.getByLabel(/Название группы/).fill(groupName)
  await create.getByRole('button', { name: 'Создать группу' }).click()

  await expect(ownerPage).toHaveURL(/\/me\/[0-9a-f-]+$/)
  await expect(ownerPage.getByRole('heading', { name: groupName, level: 1 })).toBeVisible()
  // Naming the group is a rename on the server, and its line appears at once.
  await expect(
    ownerPage.getByRole('note', { name: new RegExp(`переименовал чат в «${groupName}»`) }),
  ).toBeVisible()

  const renamed = unique('Планы')
  await ownerPage.getByRole('button', { name: 'Действия с группой' }).click()
  await ownerPage.getByRole('menuitem', { name: 'Переименовать' }).click()
  const rename = ownerPage.getByRole('dialog', { name: 'Переименовать группу' })
  await rename.getByLabel('Название группы').fill(renamed)
  await rename.getByRole('button', { name: 'Сохранить' }).click()
  await expect(ownerPage.getByRole('heading', { name: renamed, level: 1 })).toBeVisible()
  await expect(
    ownerPage.getByRole('note', { name: new RegExp(`переименовал чат в «${renamed}»`) }),
  ).toBeVisible()

  await ownerPage.getByRole('button', { name: 'Добавить людей' }).click()
  const add = ownerPage.getByRole('dialog', { name: 'Добавить людей' })
  await add.getByRole('checkbox', { name: dave.nickname }).check()
  await add.getByRole('button', { name: 'Добавить' }).click()
  await expect(ownerPage.getByRole('note', { name: /добавил/ })).toBeVisible()
  await expect(ownerPage.getByText(/4 участника/)).toBeVisible()

  // One participant leaves; the rest see the system line without a reload.
  const bobPage = await bobContext.newPage()
  await bobPage.goto('/me')
  await skipProfileOnboarding(bobPage)
  await bobPage.getByRole('link', { name: renamed }).click()
  await expect(bobPage.getByRole('heading', { name: renamed, level: 1 })).toBeVisible()
  await bobPage.getByRole('button', { name: 'Действия с группой' }).click()
  await bobPage.getByRole('menuitem', { name: 'Выйти из группы' }).click()
  const leave = bobPage.getByRole('dialog', { name: 'Выйти из группы' })
  await leave.getByRole('button', { name: 'Выйти' }).click()
  await expect(bobPage).toHaveURL(/\/me$/)
  await expect(bobPage.getByRole('link', { name: renamed })).toHaveCount(0)

  await expect(
    ownerPage.getByRole('note', { name: new RegExp(`${bob.nickname} вышел`) }),
  ).toBeVisible({ timeout: 10_000 })

  await ownerContext.close()
  await bobContext.close()
  await carolContext.close()
  await daveContext.close()
})
