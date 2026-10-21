import { expect, test, type APIRequestContext, type BrowserContext } from '@playwright/test'

import { memberCard, password, skipProfileOnboarding, unique } from './helpers.ts'

const API_URL = process.env.VITE_API_URL ?? 'http://localhost:8080'

interface Account {
  id: string
  nickname: string
}

/** One API call made with the cookie jar of a browser context. */
async function call<T>(
  api: APIRequestContext,
  method: 'post' | 'patch' | 'put' | 'delete',
  path: string,
  data?: object,
): Promise<T> {
  const url = `${API_URL}/api/v1${path}`
  const options = data === undefined ? {} : { data }
  const response = await api[method](url, options)
  expect(
    response.ok(),
    `${method.toUpperCase()} ${path} answered ${String(response.status())}`,
  ).toBe(true)
  const text = await response.text()
  return (text === '' ? undefined : JSON.parse(text)) as T
}

async function signUp(context: BrowserContext, prefix: string): Promise<Account> {
  return call<Account>(context.request, 'post', '/auth/register', {
    nickname: unique(prefix),
    password,
  })
}

/**
 * What one person changes on a server reaches another person's open page
 * without a reload: channels appear, change name, disappear — even the one
 * being read — and the member column follows who is online.
 */
test('channels and presence reach an open page live', async ({ browser }) => {
  test.setTimeout(90_000)

  const ownerContext = await browser.newContext()
  const readerContext = await browser.newContext()
  const owner = await signUp(ownerContext, 'owner')
  await signUp(readerContext, 'reader')

  const { workspace } = await call<{ workspace: { id: string } }>(
    ownerContext.request,
    'post',
    '/workspaces',
    { name: unique('Живой') },
  )
  const invite = await call<{ code: string }>(
    ownerContext.request,
    'post',
    `/workspaces/${workspace.id}/invites`,
  )
  await call(readerContext.request, 'post', `/invites/${invite.code}/accept`)
  const general = await call<{ id: string }>(
    ownerContext.request,
    'post',
    `/workspaces/${workspace.id}/channels`,
    { name: 'общий' },
  )
  const doomed = await call<{ id: string }>(
    ownerContext.request,
    'post',
    `/workspaces/${workspace.id}/channels`,
    { name: 'временный' },
  )

  // The reader has the doomed channel open; the owner has no page yet.
  const reader = await readerContext.newPage()
  await reader.goto(`/s/${workspace.id}/${doomed.id}`)
  await skipProfileOnboarding(reader)
  await expect(reader.getByRole('heading', { name: '# временный', level: 1 })).toBeVisible()
  await expect(reader.getByText('Подключаемся…')).toHaveCount(0)
  await expect(memberCard(reader, owner.nickname)).toHaveAccessibleName(/Не в сети/)

  // A channel appears, then changes its name.
  const news = await call<{ id: string }>(
    ownerContext.request,
    'post',
    `/workspaces/${workspace.id}/channels`,
    { name: 'новости' },
  )
  await expect(reader.getByRole('link', { name: '# новости' })).toBeVisible({ timeout: 5000 })
  await call(ownerContext.request, 'patch', `/channels/${news.id}`, { name: 'анонсы' })
  await expect(reader.getByRole('link', { name: '# анонсы' })).toBeVisible({ timeout: 5000 })
  await expect(reader.getByRole('link', { name: '# новости' })).toHaveCount(0)

  // The open channel is deleted: the page says so and leaves for the server.
  await call(ownerContext.request, 'delete', `/channels/${doomed.id}`)
  await expect(reader.getByText('Канал удалён или больше недоступен.')).toBeVisible({
    timeout: 5000,
  })
  await expect(reader).toHaveURL(new RegExp(`/s/${workspace.id}$`))
  await expect(reader.getByRole('link', { name: '# временный' })).toHaveCount(0)
  await expect(reader.getByRole('link', { name: '# общий' })).toBeVisible()

  // The owner comes online: the reader's member column changes the dot.
  await reader.getByRole('link', { name: '# общий' }).click()
  const ownerPage = await ownerContext.newPage()
  await ownerPage.goto(`/s/${workspace.id}/${general.id}`)
  await skipProfileOnboarding(ownerPage)
  await expect(memberCard(reader, owner.nickname)).toHaveAccessibleName(/В сети/, {
    timeout: 10_000,
  })

  await ownerContext.close()
  await readerContext.close()
})
