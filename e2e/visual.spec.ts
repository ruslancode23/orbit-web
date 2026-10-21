import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test'

import { skipProfileOnboarding } from './helpers.ts'

const API_URL = process.env.VITE_API_URL ?? 'http://localhost:8080'
const password = 'a-long-enough-password'

async function post<T>(api: APIRequestContext, path: string, data?: object): Promise<T> {
  const response = await api.post(`${API_URL}/api/v1${path}`, data ? { data } : {})
  expect(response.ok(), `${path} answered ${String(response.status())}`).toBe(true)
  return (await response.json()) as T
}

interface Seeded {
  context: Awaited<ReturnType<Browser['newContext']>>
  page: Page
  nickname: string
  workspaceId: string
  channelId: string
  voiceId: string
}

/**
 * One server with a text channel holding a few messages and a voice channel,
 * made through the API so the screens are ready before the first screenshot.
 */
async function seed(browser: Browser): Promise<Seeded> {
  const context = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 1280, height: 720 },
  })
  // A standing account makes every screenshot comparable: a fixed nickname means
  // fixed initials and a fixed box for the mask that hides it.
  const nickname = 'ux-visual'
  const registration = await context.request.post(`${API_URL}/api/v1/auth/register`, {
    data: { nickname, password },
  })
  if (registration.status() === 409) {
    const login = await context.request.post(`${API_URL}/api/v1/auth/login`, {
      data: { login: nickname, password },
    })
    expect(login.ok(), 'the standing account signs in').toBe(true)
  } else {
    expect(registration.ok(), 'the standing account is created').toBe(true)
  }
  // Start from one server each run: an old copy would add icons to the rail and
  // make every screenshot depend on how many times the suite has been run.
  const listed = await context.request.get(`${API_URL}/api/v1/workspaces`)
  const memberships = (await listed.json()) as { workspace: { id: string; name: string } }[]
  for (const membership of memberships) {
    if (membership.workspace.name === 'Команда') {
      await context.request.delete(`${API_URL}/api/v1/workspaces/${membership.workspace.id}`)
    }
  }

  const { workspace } = await post<{ workspace: { id: string } }>(context.request, '/workspaces', {
    name: 'Команда',
  })
  const channel = await post<{ id: string }>(
    context.request,
    `/workspaces/${workspace.id}/channels`,
    { name: 'общий', topic: 'Новости и вопросы команды' },
  )
  const voice = await post<{ id: string }>(
    context.request,
    `/workspaces/${workspace.id}/channels`,
    { name: 'переговорка', kind: 'voice' },
  )

  const messages = [
    'Привет, команда!',
    'Смотрим новые макеты и собираем замечания.',
    'Встречаемся в переговорке в 15:00.',
  ]
  for (const content of messages) {
    await post(context.request, `/channels/${channel.id}/messages`, {
      clientMessageId: crypto.randomUUID(),
      content,
    })
  }

  return {
    context,
    page: await context.newPage(),
    nickname,
    workspaceId: workspace.id,
    channelId: channel.id,
    voiceId: voice.id,
  }
}

/** Everything that changes between runs: the clock, the name and the avatar colors it seeds. */
const dynamicParts = (page: Page, nickname: string) => {
  return [
    // The whole header: a relative timestamp changes width as the clock moves.
    page.locator('article header'),
    page.getByText(nickname),
    page.locator('[class*="bg-avatar-"]'),
  ]
}

const expectNoSeriousViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  )
  expect(
    blocking.flatMap((violation) =>
      violation.nodes.map((node) => ({
        id: violation.id,
        target: node.target,
        html: node.html,
        why: node.failureSummary,
      })),
    ),
  ).toEqual([])
}

test.describe('accessibility', () => {
  test('the chat, the settings and a voice channel pass axe', async ({ browser }) => {
    const { context, page, nickname, workspaceId, channelId } = await seed(browser)
    await page.goto(`/s/${workspaceId}/${channelId}`)
    await skipProfileOnboarding(page)
    await expect(page.getByText('Привет, команда!')).toBeVisible()
    await expectNoSeriousViolations(page)

    await page.getByRole('button', { name: 'Настройки пользователя' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog')).toContainText(nickname)
    await expectNoSeriousViolations(page)

    await page.getByRole('tab', { name: 'Приватность' }).click()
    await expect(page.getByRole('group', { name: 'Кто может мне писать' })).toBeVisible()
    await expectNoSeriousViolations(page)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Голосовой канал переговорка' }).click()
    await expect(page.getByRole('region', { name: 'Голос подключён' })).toContainText('Подключено')
    await expectNoSeriousViolations(page)

    await context.close()
  })
})

test.describe('visual snapshots', () => {
  test.skip(
    process.platform !== 'darwin',
    'The baselines were recorded on macOS; run with --update-snapshots to record this platform.',
  )

  test('the chat, the settings, the voice channel and the member column', async ({ browser }) => {
    const { context, page, nickname, workspaceId, channelId } = await seed(browser)
    await page.goto(`/s/${workspaceId}/${channelId}`)
    await skipProfileOnboarding(page)
    await expect(page.getByText('Привет, команда!')).toBeVisible()

    // The member rows arrive after the feed, and their avatar carries the
    // presence dot: wait for the loaded row, or a screenshot could catch
    // skeletons or a dotless avatar depending on the network.
    const members = page.getByRole('complementary', { name: 'Участники' })
    await expect(members.getByRole('region', { name: 'Владелец' })).toBeVisible()
    await expect(members.getByRole('img', { name: 'В сети' })).toBeVisible()

    const masks = dynamicParts(page, nickname)

    await expect(page).toHaveScreenshot('chat.png', {
      mask: masks,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    })

    await page.getByRole('button', { name: 'Настройки пользователя' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page).toHaveScreenshot('settings.png', {
      mask: masks,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    })
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Голосовой канал переговорка' }).click()
    await expect(page.getByRole('region', { name: 'Голос подключён' })).toContainText('Подключено')

    // The fake microphone plays a tone, and a speaking ring would come and go
    // between runs; muted, the picture is the same every time.
    const user = page.getByRole('region', { name: 'Пользователь' })
    await user.getByRole('button', { name: 'Выключить микрофон' }).click()
    await expect(user.getByRole('button', { name: 'Включить микрофон' })).toBeVisible()
    await page.waitForTimeout(300)

    await expect(page).toHaveScreenshot('voice.png', {
      mask: dynamicParts(page, nickname),
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    })

    await expect(page.getByRole('complementary', { name: 'Участники' })).toHaveScreenshot(
      'members.png',
      {
        mask: dynamicParts(page, nickname),
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
      },
    )

    await context.close()
  })
})
