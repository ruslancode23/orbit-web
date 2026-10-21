import { expect, test, type APIRequestContext } from '@playwright/test'

import { openServerSettings, skipProfileOnboarding } from './helpers.ts'

const API_URL = process.env.VITE_API_URL ?? 'http://localhost:8080'
const password = 'a-long-enough-password'
const unique = (prefix: string) =>
  `${prefix}${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`

async function post<T>(api: APIRequestContext, path: string, data?: object): Promise<T> {
  const response = await api.post(`${API_URL}/api/v1${path}`, data ? { data } : {})
  expect(response.ok(), `${path} answered ${String(response.status())}`).toBe(true)
  return (await response.json()) as T
}

// The owner renames the server and lets members create channels; a member who
// has it open sees both without a reload, through workspace.updated.
test('settings reach the members live, and a member is kept out of them', async ({ browser }) => {
  const ownerContext = await browser.newContext()
  await post(ownerContext.request, '/auth/register', { nickname: unique('anna'), password })
  const { workspace } = await post<{ workspace: { id: string } }>(
    ownerContext.request,
    '/workspaces',
    { name: 'Команда' },
  )
  const general = await post<{ id: string }>(
    ownerContext.request,
    `/workspaces/${workspace.id}/channels`,
    { name: 'общий' },
  )
  const invite = await post<{ code: string }>(
    ownerContext.request,
    `/workspaces/${workspace.id}/invites`,
  )

  const memberContext = await browser.newContext()
  await post(memberContext.request, '/auth/register', { nickname: unique('boris'), password })
  await post(memberContext.request, `/invites/${invite.code}/accept`)

  const member = await memberContext.newPage()
  await member.goto(`/s/${workspace.id}/${general.id}`)
  await skipProfileOnboarding(member)
  await expect(member.getByRole('heading', { name: 'Команда', level: 2 })).toBeVisible()
  await member.getByRole('button', { name: 'Меню сервера' }).click()
  await expect(member.getByRole('menuitem', { name: 'Создать канал' })).toHaveCount(0)
  await expect(member.getByRole('menuitem', { name: 'Настройки сервера' })).toHaveCount(0)
  await member.keyboard.press('Escape')

  // Straight to the address: sent back to the server.
  await member.goto(`/s/${workspace.id}/settings`)
  await expect(member).toHaveURL(new RegExp(`/s/${workspace.id}$`))

  const owner = await ownerContext.newPage()
  await owner.goto(`/s/${workspace.id}/${general.id}`)
  await skipProfileOnboarding(owner)
  await openServerSettings(owner)
  await expect(owner.getByRole('heading', { name: 'Настройки сервера' })).toBeVisible()

  await owner.getByLabel('Название сервера').fill('Экипаж')
  await owner.getByLabel(/Описание/).fill('Про космос')
  await owner.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(owner.getByText('Сохранено')).toBeVisible()

  await owner.getByRole('switch', { name: 'Создавать каналы' }).click()
  await owner.getByRole('button', { name: 'Сохранить права' }).click()
  await expect(owner.getByText('Сохранено')).toBeVisible()

  await expect(member.getByRole('heading', { name: 'Экипаж', level: 2 })).toBeVisible()
  await member.getByRole('button', { name: 'Меню сервера' }).click()
  await expect(member.getByRole('menuitem', { name: 'Создать канал' })).toBeVisible()

  // Deleting asks for the name, then takes the owner home.
  await owner.getByRole('button', { name: 'Удалить сервер' }).click()
  const dialog = owner.getByRole('dialog', { name: 'Удалить сервер «Экипаж»?' })
  await expect(dialog.getByRole('button', { name: 'Удалить навсегда' })).toBeDisabled()
  await dialog.getByLabel('Введите название сервера, чтобы подтвердить').fill('Экипаж')
  await dialog.getByRole('button', { name: 'Удалить навсегда' }).click()
  await expect(owner).toHaveURL(/\/$/)
  await expect(owner.getByRole('link', { name: 'Экипаж' })).toHaveCount(0)

  await memberContext.close()
  await ownerContext.close()
})
