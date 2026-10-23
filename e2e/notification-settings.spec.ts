import { expect, test, type APIResponse, type Page } from '@playwright/test'

import {
  createChannel,
  inviteLink,
  password,
  skipProfileOnboarding,
  unique,
  userPanel,
} from './helpers.ts'

declare global {
  interface Window {
    __orbitNotifications?: { title: string; body: string; tag: string }[]
  }
}

const API = 'http://localhost:8080'

const readJson = async <T>(response: APIResponse): Promise<T> => (await response.json()) as T

/**
 * Replaces the browser's Notification with a recorder. Headless Chromium never
 * draws one, and the test only needs to know whether it was asked to.
 */
const captureNotifications = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    // The page-level switch is per device; this test is about the server level.
    localStorage.setItem('orbit.notifications.mode', 'all')
    // Headless Chromium denies notifications, so the test replaces the API and
    // reports what a person who allowed them would see.
    class RecordingNotification extends EventTarget {
      static readonly permission: NotificationPermission = 'granted'

      static requestPermission(): Promise<NotificationPermission> {
        return Promise.resolve('granted')
      }

      constructor(title: string, options?: NotificationOptions) {
        super()
        const shown = window.__orbitNotifications ?? []
        shown.push({ title, body: options?.body ?? '', tag: options?.tag ?? '' })
        window.__orbitNotifications = shown
      }

      close = (): void => undefined
    }
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: RecordingNotification,
    })
  })
}

const shown = async (page: Page): Promise<{ title: string; body: string; tag: string }[]> => {
  return page.evaluate(() => window.__orbitNotifications ?? [])
}

const createServer = async (page: Page, name: string): Promise<void> => {
  await page.goto('/register')
  await page.getByLabel('Ник').fill(unique('owner'))
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
  await createChannel(page, 'болтовня')
}

const openNotifications = async (page: Page, channelName: string): Promise<void> => {
  // The unread badge joins the accessible name, so match the channel part.
  const row = page.getByRole('link', { name: new RegExp(`# ${channelName}`) })
  await row.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Уведомления' }).click()
}

/** Picks a level and waits until the server stored it and the page read it back. */
const chooseLevel = async (page: Page, label: string): Promise<void> => {
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/notification-settings/') &&
      response.request().method() === 'PUT',
  )
  const refreshed = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/notification-settings') &&
      response.request().method() === 'GET',
  )
  await page.getByRole('menuitemradio', { name: label }).click()
  expect((await saved).status()).toBe(200)
  // The in-tab gate reads the cached rows: wait until the refetch landed.
  await refreshed
  await page.waitForTimeout(200)
  // A submenu choice may leave the context menu mounted; Esc closes the stack.
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
}

test('a muted channel stays quiet and the level follows the account to another device', async ({
  page,
  browser,
}) => {
  await captureNotifications(page)
  const serverName = `Тишина ${String(Date.now())}`
  await createServer(page, serverName)

  const workspaceId = new URL(page.url()).pathname.split('/')[2] ?? ''
  const owner = await readJson<{ id: string; nickname: string }>(
    await page.request.get(`${API}/api/v1/auth/me`),
  )
  const channels = await readJson<{ id: string; name: string; kind: string }[]>(
    await page.request.get(`${API}/api/v1/workspaces/${workspaceId}/channels`),
  )
  const target = channels.find((channel) => channel.name === 'болтовня')
  const other = channels.find((channel) => channel.name === 'общий')
  expect(target).toBeDefined()
  expect(other).toBeDefined()
  if (target === undefined || other === undefined) {
    return
  }

  // The owner reads another channel, so a message in «болтовня» is news.
  await page.goto(`/s/${workspaceId}/${other.id}`)
  await expect(page.getByRole('heading', { name: '# общий', level: 1 })).toBeVisible()

  // Every message in «болтовня»: the channel's own level, on the server.
  await openNotifications(page, 'болтовня')
  await page.getByRole('menuitemradio', { name: 'Все сообщения' }).click()

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
  await expect(userPanel(guestPage)).toBeVisible()

  const send = async (content: string, mentions: string[] = []) => {
    const res = await guestPage.request.post(`${API}/api/v1/channels/${target.id}/messages`, {
      data: { clientMessageId: unique('m'), content, mentions },
    })
    expect(res.ok()).toBeTruthy()
  }

  // The channel is not muted yet: its message arrives as a system notification.
  await send('первое сообщение')
  await expect.poll(async () => (await shown(page)).length, { timeout: 10_000 }).toBeGreaterThan(0)

  await page.evaluate(() => {
    window.__orbitNotifications = []
  })

  // «Ничего» from the channel menu, then the same message is silent.
  await openNotifications(page, 'болтовня')
  await chooseLevel(page, 'Ничего')

  await send('второе сообщение')
  await page.waitForTimeout(1500)
  expect(await shown(page)).toHaveLength(0)

  // «Только упоминания» lets a mention through and keeps a plain message quiet.
  await openNotifications(page, 'болтовня')
  await chooseLevel(page, 'Только упоминания')

  await send('третье сообщение')
  await page.waitForTimeout(1500)
  expect(await shown(page)).toHaveLength(0)

  await send('@владелец посмотри', [owner.id])
  await expect.poll(async () => (await shown(page)).length, { timeout: 10_000 }).toBe(1)

  // A second device of the same account sees the same level: it lives on the
  // server, not in this browser.
  const secondContext = await browser.newContext()
  const secondPage = await secondContext.newPage()
  await secondPage.goto('/login')
  await secondPage.getByLabel('Ник или email').fill(owner.nickname)
  await secondPage.getByLabel('Пароль').fill(password)
  await secondPage.getByRole('button', { name: 'Войти' }).click()
  await skipProfileOnboarding(secondPage)
  await secondPage.getByRole('link', { name: serverName }).click()
  await secondPage.getByRole('link', { name: /# болтовня/ }).click()
  await expect(secondPage.getByRole('heading', { name: '# болтовня', level: 1 })).toBeVisible()

  await openNotifications(secondPage, 'болтовня')
  await expect(
    secondPage.getByRole('menuitemradio', { name: 'Только упоминания' }),
  ).toHaveAttribute('aria-checked', 'true')

  await secondContext.close()
  await guestContext.close()
})
