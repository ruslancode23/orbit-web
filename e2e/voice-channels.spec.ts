import { expect, test, type Page } from '@playwright/test'

import {
  createChannel,
  inviteLink,
  password,
  unique,
  userPanel,
  skipProfileOnboarding,
} from './helpers.ts'

async function createVoiceServer(page: Page): Promise<string> {
  const nickname = unique('owner')
  await page.goto('/register')
  await page.getByLabel('Ник').fill(nickname)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Создать аккаунт' }).click()
  await skipProfileOnboarding(page)

  await page.getByRole('link', { name: 'Создать сервер' }).click()
  await page.getByLabel('Название сервера').fill('Голос')
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('radio', { name: /Пустой/ }).check()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByRole('button', { name: 'Создать сервер' }).click()

  await createChannel(page, 'переговорка', 'voice')
  return nickname
}

async function remoteAudioPeak(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const elements = [...document.querySelectorAll('audio')]
    const streams = elements
      .map((element) => element.srcObject)
      .filter((stream): stream is MediaStream => stream instanceof MediaStream)
    if (streams.length === 0) {
      return -1
    }

    const context = new AudioContext()
    await context.resume()
    const analyser = context.createAnalyser()
    for (const stream of streams) {
      context.createMediaStreamSource(stream).connect(analyser)
    }

    const data = new Uint8Array(analyser.frequencyBinCount)
    let peak = 0
    for (let index = 0; index < 30; index++) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      analyser.getByteFrequencyData(data)
      peak = Math.max(peak, ...data)
    }
    await context.close()
    return peak
  })
}

const panel = (page: Page) => page.getByRole('region', { name: 'Голос подключён' })
const voiceMembers = (page: Page) => page.getByRole('list', { name: 'В голосе: переговорка' })

test('two accounts join a voice channel in one click and hear each other', async ({ browser }) => {
  const ownerContext = await browser.newContext({ permissions: ['microphone'] })
  const owner = await ownerContext.newPage()
  const ownerName = await createVoiceServer(owner)
  const link = await inviteLink(owner)
  await owner.keyboard.press('Escape')

  // The owner joins and mutes before the guest arrives: presence is visible to
  // people who are not in the channel yet.
  await owner.getByRole('button', { name: 'Голосовой канал переговорка' }).click()
  await expect(panel(owner)).toContainText('Подключено')
  await userPanel(owner).getByRole('button', { name: 'Выключить микрофон' }).click()

  const guestContext = await browser.newContext({ permissions: ['microphone'] })
  const guest = await guestContext.newPage()
  const guestName = unique('Гость')
  await guest.goto(link)
  await guest.getByLabel('Ваше имя').fill(guestName)
  await guest.getByRole('button', { name: 'Войти как гость' }).click()

  const guestSidebar = guest.getByRole('list', { name: 'Участники канала переговорка' })
  await expect(guestSidebar).toContainText(ownerName, { timeout: 5000 })
  await expect(guestSidebar).toContainText('микрофон выключен')

  await guest.getByRole('button', { name: 'Голосовой канал переговорка' }).click()

  // The mute icon was checked above; bring the owner's microphone back for audio.
  await userPanel(owner).getByRole('button', { name: 'Включить микрофон' }).click()

  await expect(panel(owner)).toContainText('Подключено')
  await expect(panel(guest)).toContainText('Подключено')
  await expect(voiceMembers(owner)).toContainText(guestName)
  await expect(voiceMembers(guest)).toContainText(ownerName)
  await expect(voiceMembers(guest)).toContainText(guestName)

  // Each side receives the other's fake microphone.
  await expect.poll(() => remoteAudioPeak(owner), { timeout: 15_000 }).toBeGreaterThan(0)
  await expect.poll(() => remoteAudioPeak(guest), { timeout: 15_000 }).toBeGreaterThan(0)

  // The fake desktop capture goes out as a screen share, and the other side
  // sees it above the page until the owner stops.
  await panel(owner).getByRole('button', { name: 'Показать экран' }).click()
  await expect(panel(owner).getByRole('button', { name: 'Остановить показ' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(guest.getByRole('region', { name: 'Демонстрации экрана' })).toContainText(
    `${ownerName} показывает экран`,
    { timeout: 15_000 },
  )

  await panel(owner).getByRole('button', { name: 'Остановить показ' }).click()
  await expect(guest.getByRole('region', { name: 'Демонстрации экрана' })).toHaveCount(0)

  // A text channel is a different route, but the call stays: the provider lives in the shell.
  await createChannel(owner, 'общий')
  await expect(panel(owner)).toContainText('Подключено')
  await expect(voiceMembers(owner)).toContainText(guestName)

  await guest.getByRole('button', { name: 'Отключиться' }).click()
  await expect(panel(guest)).toHaveCount(0)
  await expect(voiceMembers(owner)).not.toContainText(guestName)

  await ownerContext.close()
  await guestContext.close()
})
