import { expect, test, type Page } from '@playwright/test'

import {
  createChannel,
  inviteLink,
  memberCard,
  password,
  unique,
  skipProfileOnboarding,
} from './helpers.ts'

const plaintext = 'совершенно секретный текст'

async function register(page: Page, nickname: string): Promise<void> {
  await page.goto('/register')
  await page.getByLabel('Ник').fill(nickname)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await skipProfileOnboarding(page)
  await expect(page.getByText(nickname, { exact: true })).toBeVisible()
}

async function createServer(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill(unique('Секретная команда'))
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('radio', { name: /Пустой/ }).check()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Создать сервер' }).click()
  await createChannel(page, 'общий')
}

async function joinServer(page: Page, link: string): Promise<void> {
  await page.goto(link)
  await page.getByRole('button', { name: 'Вступить на сервер' }).click()
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]+$/)
  await page.getByRole('link', { name: '# общий' }).click()
  await expect(page.getByRole('heading', { name: '# общий', level: 1 })).toBeVisible()
}

test('two devices talk in a secret chat: ciphertext only, timer deletes on both', async ({
  browser,
}) => {
  const ownerName = unique('anna')
  const peerName = unique('bob')
  const ownerContext = await browser.newContext()
  const peerContext = await browser.newContext()
  const owner = await ownerContext.newPage()
  const peer = await peerContext.newPage()
  await register(owner, ownerName)
  await createServer(owner)
  const link = await inviteLink(owner)
  await owner.getByRole('button', { name: 'Закрыть' }).click()

  await register(peer, peerName)
  await joinServer(peer, link)

  // The peer opts in first: a secret chat names a device on both sides.
  await peer.goto('/me')
  await peer.getByRole('button', { name: 'Включить секретные чаты' }).click()
  await expect(peer.getByRole('button', { name: 'Включить секретные чаты' })).toHaveCount(0)

  // The owner opens the dialogue with the peer and starts a secret one from its menu.
  const peerCard = memberCard(owner, peerName)
  await expect(peerCard).toBeVisible()
  await peerCard.click()
  await owner.getByRole('button', { name: 'Написать' }).click()
  await expect(owner).toHaveURL(/\/me\/[0-9a-f-]+$/)
  await owner.getByRole('button', { name: 'Действия с диалогом' }).click()
  await owner.getByRole('menuitem', { name: 'Секретный чат' }).click()
  await expect(owner).toHaveURL(/\/me\/s\/[0-9a-f-]+$/)
  await expect(owner.getByText(/Сообщения зашифрованы на ваших устройствах/)).toBeVisible()

  const envelopeBodies: string[] = []
  owner.on('request', (request) => {
    if (request.url().includes('/envelopes') && request.method() === 'POST') {
      envelopeBodies.push(request.postData() ?? '')
    }
  })

  await owner.getByLabel('Сообщение').fill(plaintext)
  await owner.getByRole('button', { name: 'Отправить' }).click()
  await expect(owner.getByText(plaintext)).toBeVisible()

  // The server only ever saw ciphertext.
  expect(envelopeBodies.length).toBeGreaterThan(0)
  for (const body of envelopeBodies) {
    expect(body).not.toContain(plaintext)
  }

  // The peer finds the chat in the personal-messages section and reads it.
  await peer.goto('/me')
  const secrets = peer.getByRole('list', { name: `Секретные чаты с ${ownerName}` })
  await secrets.getByRole('link', { name: 'Секретный чат' }).click()
  await expect(peer).toHaveURL(/\/me\/s\/[0-9a-f-]+$/)
  await expect(peer.getByText(plaintext)).toBeVisible()

  // A timer: five seconds after the peer reads it, the message is gone there.
  await owner.getByRole('button', { name: 'Таймер самоуничтожения' }).click()
  await owner.getByRole('menuitemradio', { name: '5 секунд' }).click()
  await owner.getByLabel('Сообщение').fill('это исчезнет')
  await owner.getByRole('button', { name: 'Отправить' }).click()

  await expect(peer.getByText('это исчезнет')).toBeVisible()
  await expect(peer.getByText('это исчезнет')).toHaveCount(0, { timeout: 12_000 })
  // The timer applies to messages sent after it was set; the first one stays.
  await expect(peer.getByText(plaintext)).toBeVisible()

  // Deleting the secret chat ends it for both: the dialogue stays, the
  // encrypted copy and its keys are gone.
  await owner.getByRole('button', { name: 'Действия с чатом' }).click()
  await owner.getByRole('menuitem', { name: 'Удалить секретный чат' }).click()
  await owner.getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(owner).toHaveURL(/\/me$/)
  await peer.reload()
  await expect(peer.getByText('Секретный чат')).toHaveCount(0)
  await expect(peer.getByRole('link', { name: /Секретный чат/ })).toHaveCount(0)

  await ownerContext.close()
  await peerContext.close()
})
