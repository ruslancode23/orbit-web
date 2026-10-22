import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import {
  memberCard,
  openServerSettings,
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

// The name may carry the unread count after a comma.
const channelLink = (page: Page, name: string) =>
  page
    .getByRole('region', { name: 'Текстовые каналы' })
    .getByRole('link', { name: new RegExp(`^# ${name}(,|$)`) })

// The whole roles flow, as Discord does it: the owner makes a moderator role,
// gives it to Boris, and closes a channel to everyone but that role. Boris may
// then delete Vika's message and read the closed channel; Vika loses it live;
// and Boris cannot touch a role as high as his own.
test('a moderator role: groups, deleting, a closed channel and the ranks', async ({ browser }) => {
  const ownerContext = await browser.newContext()
  await post(ownerContext.request, '/auth/register', { nickname: unique('anna'), password })
  const { workspace } = await post<{ workspace: { id: string } }>(
    ownerContext.request,
    '/workspaces',
    { name: 'Роли' },
  )
  const general = await post<{ id: string }>(
    ownerContext.request,
    `/workspaces/${workspace.id}/channels`,
    { name: 'общий' },
  )
  await post(ownerContext.request, `/workspaces/${workspace.id}/channels`, { name: 'штаб' })
  const invite = await post<{ code: string }>(
    ownerContext.request,
    `/workspaces/${workspace.id}/invites`,
  )

  const join = async (prefix: string) => {
    const context = await browser.newContext()
    const nickname = unique(prefix)
    await post(context.request, '/auth/register', { nickname, password })
    await post(context.request, `/invites/${invite.code}/accept`)
    return { context, nickname }
  }
  const boris = await join('boris')
  const vika = await join('vika')
  const spam = unique('спам')
  await post(vika.context.request, `/channels/${general.id}/messages`, {
    clientMessageId: unique('m'),
    content: spam,
  })

  // The owner makes the role in the server settings.
  const owner = await ownerContext.newPage()
  await owner.goto(`/s/${workspace.id}/${general.id}`)
  await skipProfileOnboarding(owner)
  await openServerSettings(owner)
  await owner.getByRole('button', { name: 'Создать роль' }).click()
  const draft = owner.getByRole('form', { name: 'Роль Новая роль' })
  await draft.getByLabel('Название').fill('Модератор')
  await draft.getByRole('button', { name: 'Красный' }).click()
  await draft.getByRole('switch', { name: 'Показывать участников отдельно' }).click()
  await draft.getByRole('switch', { name: 'Удалять чужие сообщения' }).click()
  await draft.getByRole('switch', { name: 'Управлять ролями' }).click()
  await draft.getByRole('button', { name: 'Сохранить роль' }).click()
  await expect(owner.getByRole('button', { name: 'Изменить роль Модератор' })).toBeVisible()

  // …gives it to Boris from his card…
  await owner.goto(`/s/${workspace.id}/${general.id}`)
  await memberCard(owner, boris.nickname).click()
  await owner.getByRole('switch', { name: 'Роль Модератор' }).click()
  await expect(owner.getByRole('switch', { name: 'Роль Модератор' })).toBeChecked()
  await owner.keyboard.press('Escape')
  await expect(
    owner.getByRole('complementary', { name: 'Участники' }).getByRole('heading', {
      name: 'Модератор — 1',
    }),
  ).toBeVisible()

  // …and closes «штаб» to everyone but moderators.
  await owner.getByRole('button', { name: 'Настройки канала штаб' }).click()
  await owner.getByRole('tab', { name: 'Права' }).click()
  const everyone = owner.getByRole('form', { name: 'Права роли @everyone в канале' })
  await everyone
    .getByRole('group', { name: 'Видеть каналы' })
    .getByText('Запретить', { exact: true })
    .click()
  await everyone.getByRole('button', { name: 'Сохранить права' }).click()
  await expect(everyone.getByText('Сохранено')).toBeVisible()
  await owner.getByRole('button', { name: 'Права роли Модератор' }).click()
  const moderators = owner.getByRole('form', { name: 'Права роли Модератор в канале' })
  await moderators
    .getByRole('group', { name: 'Видеть каналы' })
    .getByText('Разрешить', { exact: true })
    .click()
  await moderators.getByRole('button', { name: 'Сохранить права' }).click()
  await expect(moderators.getByText('Сохранено')).toBeVisible()
  await owner.keyboard.press('Escape')

  // Vika no longer sees the closed channel.
  const vikaPage = await vika.context.newPage()
  await vikaPage.goto(`/s/${workspace.id}/${general.id}`)
  await skipProfileOnboarding(vikaPage)
  await expect(channelLink(vikaPage, 'общий')).toBeVisible()
  await expect(channelLink(vikaPage, 'штаб')).toHaveCount(0)

  // Boris reads it, and deletes Vika's message in «общий».
  const borisPage = await boris.context.newPage()
  await borisPage.goto(`/s/${workspace.id}/${general.id}`)
  await skipProfileOnboarding(borisPage)
  await expect(channelLink(borisPage, 'штаб')).toBeVisible()
  const message = borisPage.getByRole('article').filter({ hasText: spam })
  await message.hover()
  await expect(message.getByRole('button', { name: 'Изменить' })).toHaveCount(0)
  await message.getByRole('button', { name: 'Удалить' }).click()
  await borisPage
    .getByRole('group', { name: 'Подтверждение удаления' })
    .getByRole('button', { name: 'Удалить' })
    .click()
  await expect(borisPage.getByText(spam)).toHaveCount(0)

  // He manages roles, but not his own one: it is shown, not editable.
  await openServerSettings(borisPage)
  await expect(borisPage.getByRole('button', { name: 'Опустить роль Модератор' })).toHaveCount(0)
  await borisPage.getByRole('button', { name: 'Изменить роль Модератор' }).click()
  await expect(
    borisPage.getByRole('form', { name: 'Роль Модератор' }).getByText(/можно только посмотреть/),
  ).toBeVisible()
  await expect(borisPage.getByRole('region', { name: 'Обзор' })).toHaveCount(0)

  await vika.context.close()
  await boris.context.close()
  await ownerContext.close()
})
