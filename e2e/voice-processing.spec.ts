import { expect, test, type Page } from '@playwright/test'

import { createVoiceServer, inviteLink, remoteAudioPeak, unique, userPanel } from './helpers.ts'

declare global {
  interface Window {
    /** Audio constraints of every getUserMedia call, recorded by the init script below. */
    __audioCaptures: MediaTrackConstraints[]
    /** Names of the AudioWorklet nodes the page created. */
    __worklets: string[]
    /** Every RTCPeerConnection the page opened. */
    __peers: RTCPeerConnection[]
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

// RNNoise runs as an AudioWorklet node, and LiveKit sends its output instead of the device:
// both are recorded by wrapping the constructors.
const recordAudioPipeline = async (page: Page) => {
  await page.addInitScript(() => {
    window.__worklets = []
    window.__peers = []
    const Worklet = AudioWorkletNode
    window.AudioWorkletNode = class extends Worklet {
      constructor(context: BaseAudioContext, name: string, options?: AudioWorkletNodeOptions) {
        super(context, name, options)
        window.__worklets.push(name)
      }
    }
    const Peer = RTCPeerConnection
    window.RTCPeerConnection = class extends Peer {
      constructor(configuration?: RTCConfiguration) {
        super(configuration)
        window.__peers.push(this)
      }
    }
  })
}

/** Labels of the audio tracks the page sends; the fake device's has «fake» in it. */
const sentAudio = (page: Page) =>
  page.evaluate(() =>
    window.__peers.flatMap((peer) =>
      peer
        .getSenders()
        .map((sender) => sender.track)
        .filter((track) => track?.kind === 'audio')
        .map((track) => track?.label ?? ''),
    ),
  )

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
  await expect(page.getByRole('radio', { name: /Стандартное/ })).toBeChecked()
  const off = page.getByRole('radio', { name: /Выключено/ })
  await off.check()
  await expect(off).toBeChecked()

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

test('enhanced noise suppression runs RNNoise on the published microphone', async ({ browser }) => {
  const ownerContext = await browser.newContext({ permissions: ['microphone'] })
  const owner = await ownerContext.newPage()
  await recordAudioCaptures(owner)
  await recordAudioPipeline(owner)
  const errors: string[] = []
  owner.on('pageerror', (error) => errors.push(error.message))
  await createVoiceServer(owner)
  const link = await inviteLink(owner)
  await owner.keyboard.press('Escape')

  await owner.getByRole('button', { name: 'Голосовой канал переговорка' }).click()
  await expect(panel(owner)).toContainText('Подключено')

  const guestContext = await browser.newContext({ permissions: ['microphone'] })
  const guest = await guestContext.newPage()
  await guest.goto(link)
  await guest.getByLabel('Ваше имя').fill(unique('Гость'))
  await guest.getByRole('button', { name: 'Войти как гость' }).click()
  await guest.getByRole('button', { name: 'Голосовой канал переговорка' }).click()
  await expect(panel(guest)).toContainText('Подключено')
  await expect.poll(() => remoteAudioPeak(guest), { timeout: 15_000 }).toBeGreaterThan(0)
  // Before the switch the device itself is sent: the probe below can tell the two apart.
  expect(await sentAudio(owner)).toEqual([expect.stringMatching(/fake/i)])

  await openVoiceSettings(owner)
  await owner.getByRole('radio', { name: /Усиленное/ }).check()

  // The browser's own suppression is off: RNNoise does the work instead of on top of it.
  await expect.poll(() => lastCapture(owner)).toMatchObject({ noiseSuppression: false })
  await expect(owner.getByText('не запустилось в этом браузере')).toBeHidden()
  await expect
    .poll(() => owner.evaluate(() => window.__worklets))
    .toContain('@sapphi-red/web-noise-suppressor/rnnoise')
  // What goes over WebRTC is the worklet's output, not the device…
  await expect
    .poll(() => sentAudio(owner), { timeout: 10_000 })
    .toEqual([expect.not.stringMatching(/fake/i)])
  // …and it still carries sound to the other side.
  await expect.poll(() => remoteAudioPeak(guest), { timeout: 15_000 }).toBeGreaterThan(0)
  expect(errors).toEqual([])
  await owner.keyboard.press('Escape')
  await expect(panel(owner)).toContainText('Подключено')

  await ownerContext.close()
  await guestContext.close()
})
