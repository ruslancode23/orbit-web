import { expect, test, type Page } from '@playwright/test'

import { createVoiceServer, userPanel } from './helpers.ts'

declare global {
  interface Window {
    /** Audio constraints of every getUserMedia call, recorded by the init script below. */
    __audioCaptures: MediaTrackConstraints[]
  }
}

// What the page asked the browser for is the only honest view of the processing
// from outside: LiveKit and the fake device do not report it back.
const recordAudioCaptures = async (page: Page) => {
  await page.addInitScript(() => {
    window.__audioCaptures = []
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = (constraints) => {
      if (constraints && typeof constraints.audio === 'object') {
        window.__audioCaptures.push(constraints.audio)
      }
      return original(constraints)
    }
  })
}

const lastCapture = (page: Page) => page.evaluate(() => window.__audioCaptures.at(-1))

const panel = (page: Page) => page.getByRole('region', { name: 'Голос подключён' })

const openVoiceSettings = async (page: Page) => {
  await userPanel(page).getByRole('button', { name: 'Настройки пользователя' }).click()
  await page.getByRole('tab', { name: 'Голос и видео' }).click()
}

test('microphone processing changes in a running call and is kept for the next one', async ({
  page,
}) => {
  await recordAudioCaptures(page)
  await createVoiceServer(page)

  await page.getByRole('button', { name: 'Голосовой канал переговорка' }).click()
  await expect(panel(page)).toContainText('Подключено')
  expect(await lastCapture(page)).toMatchObject({
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
  })

  await openVoiceSettings(page)
  const noise = page.getByRole('switch', { name: 'Шумоподавление' })
  await expect(noise).toBeChecked()
  await noise.click()
  await expect(noise).not.toBeChecked()

  // The microphone is re-acquired without the browser's noise suppression, and the call goes on.
  await expect.poll(() => lastCapture(page)).toMatchObject({ noiseSuppression: false })
  await page.keyboard.press('Escape')
  await expect(panel(page)).toContainText('Подключено')
  await expect(userPanel(page).getByRole('button', { name: 'Выключить микрофон' })).toBeVisible()

  // A reload is a new room: it captures with the remembered choice.
  await page.reload()
  await page.getByRole('button', { name: 'Голосовой канал переговорка' }).click()
  await expect(panel(page)).toContainText('Подключено')
  expect(await lastCapture(page)).toMatchObject({
    noiseSuppression: false,
    echoCancellation: true,
  })
})
