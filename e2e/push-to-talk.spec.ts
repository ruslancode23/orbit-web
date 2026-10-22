import { expect, test, type Page } from '@playwright/test'

import { createVoiceServer, inviteLink, remoteAudioPeak, unique, userPanel } from './helpers.ts'

const panel = (page: Page) => page.getByRole('region', { name: 'Голос подключён' })
const voiceMembers = (page: Page) => page.getByRole('list', { name: 'В голосе: переговорка' })

test('with push-to-talk the others hear the microphone only while the key is held', async ({
  browser,
}) => {
  const ownerContext = await browser.newContext({ permissions: ['microphone'] })
  const owner = await ownerContext.newPage()
  const ownerName = await createVoiceServer(owner)
  const link = await inviteLink(owner)
  await owner.keyboard.press('Escape')

  // Chosen before joining: the room starts with the microphone published but silent.
  await userPanel(owner).getByRole('button', { name: 'Настройки пользователя' }).click()
  await owner.getByRole('tab', { name: 'Голос и видео' }).click()
  await owner.getByRole('radio', { name: /По нажатию клавиши/ }).check()
  await expect(owner.getByText('Работает, пока вкладка Orbit открыта')).toBeVisible()
  await owner.keyboard.press('Escape')

  await owner.getByRole('button', { name: 'Голосовой канал переговорка' }).click()
  await expect(panel(owner)).toContainText('Подключено')
  const holdButton = panel(owner).getByRole('button', { name: 'Удерживайте, чтобы говорить' })
  await expect(holdButton).toBeVisible()

  const guestContext = await browser.newContext({ permissions: ['microphone'] })
  const guest = await guestContext.newPage()
  await guest.goto(link)
  await guest.getByLabel('Ваше имя').fill(unique('Гость'))
  await guest.getByRole('button', { name: 'Войти как гость' }).click()
  await guest.getByRole('button', { name: 'Голосовой канал переговорка' }).click()
  await expect(panel(guest)).toContainText('Подключено')
  await expect(voiceMembers(guest)).toContainText(ownerName)

  // Quiet between phrases is not a mute: no muted icon for the owner.
  const ownerRow = voiceMembers(guest).getByRole('listitem').filter({ hasText: ownerName })
  await expect(ownerRow).toBeVisible()
  await expect(ownerRow).not.toContainText('микрофон выключен')
  // A real mute still shows: the attribute is only set while talking by key.
  await userPanel(owner).getByRole('button', { name: 'Выключить микрофон' }).click()
  await expect(ownerRow).toContainText('микрофон выключен')
  await userPanel(owner).getByRole('button', { name: 'Включить микрофон' }).click()
  await expect(ownerRow).not.toContainText('микрофон выключен')
  await expect.poll(() => remoteAudioPeak(guest), { timeout: 10_000 }).toBeLessThanOrEqual(0)

  // The key opens the microphone; letting go closes it again.
  await owner.locator('body').click()
  await owner.keyboard.down('Backquote')
  await expect(panel(owner).getByRole('button', { name: 'Говорите…' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect.poll(() => remoteAudioPeak(guest), { timeout: 15_000 }).toBeGreaterThan(0)
  await owner.keyboard.up('Backquote')
  await expect(holdButton).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(() => remoteAudioPeak(guest), { timeout: 10_000 }).toBeLessThanOrEqual(0)

  // The panel button does the same for a mouse or a finger.
  const box = await holdButton.boundingBox()
  if (!box) {
    throw new Error('the hold button has no box')
  }
  await owner.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await owner.mouse.down()
  await expect.poll(() => remoteAudioPeak(guest), { timeout: 15_000 }).toBeGreaterThan(0)
  await owner.mouse.up()
  await expect.poll(() => remoteAudioPeak(guest), { timeout: 10_000 }).toBeLessThanOrEqual(0)

  await ownerContext.close()
  await guestContext.close()
})
