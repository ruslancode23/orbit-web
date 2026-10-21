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
  await expect(
    reader.getByText('Канал удалён или больше недоступен.', { exact: true }),
  ).toBeVisible({
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

/**
 * A dropped connection (sleep, a new network, a server restart) misses every
 * event of the gap: the catch-up by cursor replays new messages only. When the
 * stream comes back, the page asks again for what it shows, so an edit, a
 * reaction and a new channel from the gap appear without a reload.
 */
test('what changed during a dropped connection appears once it is back', async ({ browser }) => {
  test.setTimeout(90_000)

  const ownerContext = await browser.newContext()
  const readerContext = await browser.newContext()
  await signUp(ownerContext, 'owner')
  await signUp(readerContext, 'reader')

  const { workspace } = await call<{ workspace: { id: string } }>(
    ownerContext.request,
    'post',
    '/workspaces',
    { name: unique('Обрыв') },
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
  const before = unique('до обрыва')
  const message = await call<{ id: string }>(
    ownerContext.request,
    'post',
    `/channels/${general.id}/messages`,
    { clientMessageId: crypto.randomUUID(), content: before },
  )

  // The reader's stream goes through a route the test can cut and hold shut.
  const reader = await readerContext.newPage()
  let shut = false
  const live: { close: () => Promise<void> }[] = []
  await reader.routeWebSocket(/\/api\/v1\/ws/, (socket) => {
    if (shut) {
      void socket.close()
      return
    }
    socket.connectToServer()
    live.push(socket)
  })

  await reader.goto(`/s/${workspace.id}/${general.id}`)
  await skipProfileOnboarding(reader)
  const chat = reader.getByRole('region', { name: 'Чат' })
  await expect(chat.getByText(before, { exact: true })).toBeVisible()
  await expect(reader.getByText('Подключаемся…')).toHaveCount(0)

  // The connection drops and stays down while the owner changes things.
  shut = true
  await Promise.all(live.map((socket) => socket.close()))
  const edited = unique('правка в обрыве')
  await call(ownerContext.request, 'patch', `/messages/${message.id}`, { content: edited })
  await call(
    ownerContext.request,
    'put',
    `/messages/${message.id}/reactions/${encodeURIComponent('👍')}`,
  )
  await call(ownerContext.request, 'post', `/workspaces/${workspace.id}/channels`, {
    name: 'пока-вас-не-было',
  })
  // Nothing of it can have arrived: the page still shows the old text.
  await expect(chat.getByText(before, { exact: true })).toBeVisible()

  // The connection comes back by itself; the page refreshes what it shows.
  shut = false
  await expect(chat.getByText(edited)).toBeVisible({ timeout: 15_000 })
  await expect(chat.getByRole('button', { name: /👍, 1 реакция/ })).toBeVisible()
  await expect(reader.getByRole('link', { name: '# пока-вас-не-было' })).toBeVisible()

  await ownerContext.close()
  await readerContext.close()
})

/**
 * The owner deletes a server. A reader inside it is taken out with a word on
 * why; a reader elsewhere simply loses it from the rail — the event travels on
 * each member's own stream, not only to those watching that server.
 */
test('a deleted server leaves every member, open or not', async ({ browser }) => {
  test.setTimeout(90_000)

  const ownerContext = await browser.newContext()
  const readerContext = await browser.newContext()
  await signUp(ownerContext, 'owner')
  await signUp(readerContext, 'reader')

  const join = async (name: string) => {
    const { workspace } = await call<{ workspace: { id: string } }>(
      ownerContext.request,
      'post',
      '/workspaces',
      { name },
    )
    const invite = await call<{ code: string }>(
      ownerContext.request,
      'post',
      `/workspaces/${workspace.id}/invites`,
    )
    await call(readerContext.request, 'post', `/invites/${invite.code}/accept`)
    const channel = await call<{ id: string }>(
      ownerContext.request,
      'post',
      `/workspaces/${workspace.id}/channels`,
      { name: 'общий' },
    )
    return { id: workspace.id, channelId: channel.id, name }
  }
  const open = await join(unique('Открытый'))
  const elsewhere = await join(unique('Другой'))

  const reader = await readerContext.newPage()
  await reader.goto(`/s/${open.id}/${open.channelId}`)
  await skipProfileOnboarding(reader)
  await expect(reader.getByRole('heading', { name: '# общий', level: 1 })).toBeVisible()
  await expect(reader.getByText('Подключаемся…')).toHaveCount(0)
  await expect(reader.getByRole('link', { name: elsewhere.name })).toBeVisible()

  // The server being read is deleted: the reader is taken out.
  await call(ownerContext.request, 'delete', `/workspaces/${open.id}`)
  await expect(reader.getByText('Сервер удалён.', { exact: true })).toBeVisible({ timeout: 5000 })
  await expect(reader).toHaveURL(/\/$/)
  await expect(reader.getByRole('link', { name: open.name })).toHaveCount(0)

  // A server that is not open is deleted: it just leaves the rail.
  await reader.getByRole('link', { name: /Личные сообщения/ }).click()
  await expect(reader).toHaveURL(/\/me$/)
  await call(ownerContext.request, 'delete', `/workspaces/${elsewhere.id}`)
  await expect(reader.getByRole('link', { name: elsewhere.name })).toHaveCount(0, { timeout: 5000 })
  await expect(reader).toHaveURL(/\/me$/)

  await ownerContext.close()
  await readerContext.close()
})
