import { expect, test, type Page } from '@playwright/test'

const unique = () => `shell${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`
const password = 'a-long-enough-password'

async function signUp(page: Page): Promise<string> {
  const nickname = unique()
  await page.goto('/register')
  await page.getByLabel('Ник').fill(nickname)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await expect(page.getByText('Создайте свой первый сервер')).toBeVisible()
  return nickname
}

async function createWorkspace(page: Page, name: string, template = /Пустой/) {
  await page.getByRole('link', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill(name)
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('radio', { name: template }).check()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Создать сервер' }).click()
  await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible()
}

async function createChannel(page: Page, name: string) {
  await page.getByRole('button', { name: '+ Канал' }).click()
  await page.getByLabel('Название канала').fill(name)
  await page.getByRole('button', { name: 'Создать', exact: true }).click()
  await expect(page.getByRole('link', { name: `# ${name}` })).toBeVisible()
}

test('a server, its channels and switching between them', async ({ page }) => {
  await signUp(page)
  await createWorkspace(page, 'Команда')

  await expect(page.getByText('В этом сервере пока нет каналов')).toBeVisible()
  await createChannel(page, 'общий')
  await createChannel(page, 'задачи')

  // The route carries both the server and the channel.
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]+\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { name: '# задачи', level: 1 })).toBeVisible()

  // Switching channels keeps the same live connection: the stream is not reopened.
  // Only our own stream is counted; the dev server has a socket of its own.
  const opened = await page.evaluate(() => {
    const target = window as unknown as { __sockets?: number }
    target.__sockets = 0
    const Real = WebSocket
    window.WebSocket = class extends Real {
      constructor(url: string | URL, protocols?: string | string[]) {
        if (String(url).includes('/api/v1/ws')) {
          target.__sockets = (target.__sockets ?? 0) + 1
        }
        super(url, protocols)
      }
    }
    return target.__sockets
  })
  expect(opened).toBe(0)

  await page.getByRole('link', { name: '# общий' }).click()
  await expect(page.getByRole('heading', { name: '# общий', level: 1 })).toBeVisible()

  const afterSwitch = await page.evaluate(
    () => (window as unknown as { __sockets?: number }).__sockets,
  )
  expect(afterSwitch).toBe(0)
})

test('the owner sees managing, and the member list names them', async ({ page }) => {
  const nickname = await signUp(page)
  await createWorkspace(page, 'Команда')

  await expect(page.getByRole('button', { name: '+ Канал' })).toBeVisible()
  await page.getByRole('button', { name: 'Участники' }).click()

  await expect(page.getByText(`${nickname} (владелец)`)).toBeVisible()
  // Nobody moderates themselves.
  await expect(page.getByRole('button', { name: 'Забанить' })).toHaveCount(0)
})

test('a new server from a template opens its first channel', async ({ page }) => {
  await signUp(page)
  await page.getByRole('link', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill('Команда')
  await page.getByLabel(/Описание/).fill('Про космос')
  await page.getByRole('button', { name: 'Далее' }).click()
  // «Для команды» is the default; going back keeps what was typed.
  await page.getByRole('button', { name: 'Назад' }).click()
  await expect(page.getByLabel('Название сервера')).toHaveValue('Команда')
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('switch', { name: 'Создавать каналы' }).click()
  await page.getByRole('button', { name: 'Создать сервер' }).click()

  await expect(page.getByRole('heading', { name: '# общий', level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: '# оффтоп' })).toBeVisible()
})
