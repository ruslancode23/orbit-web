import { expect, test, type Page } from '@playwright/test'

import {
  createChannel,
  createVoiceServer,
  inviteLink,
  remoteAudioPeak,
  unique,
  userPanel,
} from './helpers.ts'

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
