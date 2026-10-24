import { expect, test, type APIResponse, type Page } from '@playwright/test'

import { createChannel, inviteLink, password, skipProfileOnboarding, unique } from './helpers.ts'

const API = 'http://localhost:8080'

const readJson = async <T>(response: APIResponse): Promise<T> => (await response.json()) as T

async function createServer(page: Page, name: string): Promise<string> {
  await page.goto('/register')
  await page.getByLabel('Ник').fill(unique('поиск'))
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await skipProfileOnboarding(page)

  await page.getByRole('link', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill(name)
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('radio', { name: /Пустой/ }).check()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Создать сервер' }).click()
  await createChannel(page, 'общий')
  await createChannel(page, 'скрытый')

  return new URL(page.url()).pathname.split('/')[2] ?? ''
}

async function send(
  page: Page,
  channelId: string,
  content: string,
): Promise<{ id: string; seq: number }> {
  const response = await page.request.post(`${API}/api/v1/channels/${channelId}/messages`, {
    data: { clientMessageId: unique('m'), content },
  })
  expect(response.ok()).toBeTruthy()
  return readJson<{ id: string; seq: number }>(response)
}

test('finds a message, opens it in the history, and never finds a hidden channel', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000)
  const workspaceId = await createServer(page, `Поиск ${String(Date.now())}`)

  const channels = await readJson<{ id: string; name: string }[]>(
    await page.request.get(`${API}/api/v1/workspaces/${workspaceId}/channels`),
  )
  const general = channels.find((channel) => channel.name === 'общий')
  const hidden = channels.find((channel) => channel.name === 'скрытый')
  expect(general).toBeDefined()
  expect(hidden).toBeDefined()
  if (general === undefined || hidden === undefined) {
    return
  }

  // The target is far enough in the past to prove the jump loads a window
  // around it rather than the newest page.
  const first = await send(page, general.id, 'первый поискмаркер')
  for (let index = 0; index < 5; index += 1) {
    await send(page, general.id, `заполняющее сообщение ${String(index)}`)
  }
  await page.goto(`/s/${workspaceId}/${general.id}`)
  await expect(page.getByRole('heading', { name: '# общий', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'Поиск по сообщениям' }).click()
  await page.getByRole('textbox', { name: 'Поиск по сообщениям' }).fill('поискмаркер')

  const results = page.getByRole('list', { name: 'Результаты поиска' })
  const result = results.getByRole('button', { name: /первый поискмаркер/ })
  await expect(result).toBeVisible()
  await expect(results.getByText('поискмаркер', { exact: true }).first()).toHaveJSProperty(
    'tagName',
    'MARK',
  )
  await result.click()

  await expect(page).toHaveURL(
    new RegExp(`/s/${workspaceId}/${general.id}\\?at=${String(first.seq)}`),
  )
  const article = page.locator(`[data-message-id="${first.id}"]`)
  await expect(article).toContainText('первый поискмаркер')

  // A guest sees only what it may read: the hidden channel is not searched.
  const link = await inviteLink(page)
  await page
    .getByRole('dialog', { name: 'Приглашение' })
    .getByRole('button', { name: 'Закрыть' })
    .click()

  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto(link)
  await guestPage.getByLabel('Ваше имя').fill(unique('Гость'))
  await guestPage.getByRole('button', { name: 'Войти как гость' }).click()

  // @everyone loses the channel after the guest is already in the server.
  const roles = await readJson<{ id: string; isDefault: boolean }[]>(
    await page.request.get(`${API}/api/v1/workspaces/${workspaceId}/roles`),
  )
  const everyone = roles.find((role) => role.isDefault)
  expect(everyone).toBeDefined()
  if (everyone === undefined) {
    return
  }
  const override = await page.request.put(
    `${API}/api/v1/channels/${hidden.id}/overrides/${everyone.id}`,
    { data: { allow: [], deny: ['viewChannel'] } },
  )
  expect(override.ok()).toBeTruthy()

  await send(page, hidden.id, 'скрытыймаркер внутри')
  await guestPage.getByRole('link', { name: /# общий/ }).click()
  await guestPage.getByRole('button', { name: 'Поиск по сообщениям' }).click()
  await guestPage.getByRole('button', { name: 'На сервере' }).click()
  await guestPage.getByRole('textbox', { name: 'Поиск по сообщениям' }).fill('скрытыймаркер')
  await expect(guestPage.getByText('Ничего не найдено.')).toBeVisible()

  // The owner still sees it: the message exists, the guest just may not read it.
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Поиск по сообщениям' }).click()
  await page.getByRole('button', { name: 'На сервере' }).click()
  await page.getByRole('textbox', { name: 'Поиск по сообщениям' }).fill('скрытыймаркер')
  await expect(
    page.getByRole('list', { name: 'Результаты поиска' }).getByRole('button', {
      name: /скрытыймаркер внутри/,
    }),
  ).toBeVisible()

  await guestContext.close()
})
