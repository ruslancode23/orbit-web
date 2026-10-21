import { expect, test, type APIRequestContext } from '@playwright/test'

import { skipProfileOnboarding } from './helpers.ts'

const API_URL = process.env.VITE_API_URL ?? 'http://localhost:8080'
const password = 'a-long-enough-password'
const unique = (prefix: string) =>
  `${prefix}${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`

async function post<T>(api: APIRequestContext, path: string, data?: object): Promise<T> {
  const response = await api.post(`${API_URL}/api/v1${path}`, data ? { data } : {})
  expect(response.ok(), `${path} answered ${String(response.status())}`).toBe(true)
  return (await response.json()) as T
}

/**
 * The same short journey in every engine: the three columns, history, a sent
 * message and the settings tabs. What differs between Chromium, Firefox and
 * WebKit is CSS and events, not the API, so this is where they show up.
 */
test('the shell, the chat and the settings work in this browser', async ({
  browser,
  browserName,
}) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  await post(context.request, '/auth/register', { nickname: unique('cross'), password })
  const { workspace } = await post<{ workspace: { id: string } }>(context.request, '/workspaces', {
    name: `Команда ${browserName}`,
  })
  const channel = await post<{ id: string }>(
    context.request,
    `/workspaces/${workspace.id}/channels`,
    { name: 'общий', topic: 'Проверка браузера' },
  )
  await post(context.request, `/channels/${channel.id}/messages`, {
    clientMessageId: crypto.randomUUID(),
    content: 'Привет из этого браузера',
  })

  const page = await context.newPage()
  await page.goto(`/s/${workspace.id}/${channel.id}`)
  await skipProfileOnboarding(page)

  await expect(page.getByRole('log', { name: 'Сообщения' })).toContainText(
    'Привет из этого браузера',
  )
  await expect(page.getByRole('complementary', { name: 'Каналы' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Участники' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '# общий', level: 1 })).toBeVisible()

  await page.getByRole('textbox', { name: 'Сообщение' }).fill(`Ответ из ${browserName}`)
  await page.getByRole('button', { name: 'Отправить' }).click()
  await expect(page.getByText(`Ответ из ${browserName}`)).toBeVisible()

  await page.getByRole('button', { name: 'Настройки пользователя' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('tab', { name: 'Уведомления' }).click()
  await expect(page.getByRole('combobox', { name: 'Уведомления' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Evidence for the manual pass comment in Jira.
  await page.screenshot({ path: `/tmp/orbit-${browserName}.png`, fullPage: true })

  await context.close()
})
