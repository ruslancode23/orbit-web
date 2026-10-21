import { expect, request, test, type APIRequestContext } from '@playwright/test'

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

// One account on two devices: reading a channel on one puts the badge out on
// the other, through the server's read.changed, without a reload.
test('a channel read on one device stops being unread on the other', async ({ browser }) => {
  const laptop = await browser.newContext()
  const owner = await post<{ id: string }>(laptop.request, '/auth/register', {
    nickname: unique('anna'),
    password,
  })
  const { workspace } = await post<{ workspace: { id: string } }>(laptop.request, '/workspaces', {
    name: 'Команда',
  })
  const general = await post<{ id: string }>(
    laptop.request,
    `/workspaces/${workspace.id}/channels`,
    { name: 'общий' },
  )
  const flood = await post<{ id: string }>(laptop.request, `/workspaces/${workspace.id}/channels`, {
    name: 'флуд',
  })
  const invite = await post<{ code: string }>(laptop.request, `/workspaces/${workspace.id}/invites`)

  // The same session cookie on a second device.
  const phone = await browser.newContext({ storageState: await laptop.storageState() })

  const laptopPage = await laptop.newPage()
  const phonePage = await phone.newPage()
  await laptopPage.goto(`/s/${workspace.id}/${general.id}`)
  await phonePage.goto(`/s/${workspace.id}/${general.id}`)
  await skipProfileOnboarding(laptopPage)
  await skipProfileOnboarding(phonePage)
  for (const page of [laptopPage, phonePage]) {
    await expect(page.getByRole('link', { name: '# флуд', exact: true })).toBeVisible()
  }

  // Someone else writes in the other channel and mentions the owner.
  const boris = await request.newContext()
  await post(boris, '/auth/register', { nickname: unique('boris'), password })
  await post(boris, `/invites/${invite.code}/accept`)
  await post(boris, `/channels/${flood.id}/messages`, {
    clientMessageId: crypto.randomUUID(),
    content: 'загляни сюда',
    mentions: [owner.id],
  })

  const unread = { name: '# флуд, 1 непрочитанное, 1 упоминание' }
  await expect(laptopPage.getByRole('link', unread)).toBeVisible()
  await expect(phonePage.getByRole('link', unread)).toBeVisible()

  await phonePage.getByRole('link', unread).click()
  await expect(phonePage.getByText('загляни сюда')).toBeVisible()

  await expect(laptopPage.getByRole('link', { name: '# флуд', exact: true })).toBeVisible()

  await boris.dispose()
  await phone.close()
  await laptop.close()
})
