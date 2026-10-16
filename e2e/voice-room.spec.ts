import { expect, test, type Page } from '@playwright/test'

// Unique room per run so parallel or repeated runs never meet.
const room = `e2e-${Date.now().toString(36)}`

async function join(page: Page, name: string) {
  await page.goto(`/room/${room}`)
  await page.getByLabel('Ваше имя').fill(name)
  await page.getByRole('button', { name: 'Войти в комнату' }).click()
  await expect(page.getByText('Вы в комнате')).toBeVisible()
}

/**
 * Peak level (0–255) of the remote audio this page actually receives, measured with
 * Web Audio over ~1.5 s on the srcObject of the <audio> elements LiveKit attached.
 */
async function remoteAudioPeak(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const elements = [...document.querySelectorAll('audio')]
    const streams = elements
      .map((el) => el.srcObject)
      .filter((s): s is MediaStream => s instanceof MediaStream)
    if (streams.length === 0) return -1

    const ctx = new AudioContext()
    await ctx.resume()
    const analyser = ctx.createAnalyser()
    for (const stream of streams) ctx.createMediaStreamSource(stream).connect(analyser)

    const data = new Uint8Array(analyser.frequencyBinCount)
    let peak = 0
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      analyser.getByteFrequencyData(data)
      peak = Math.max(peak, ...data)
    }
    await ctx.close()
    return peak
  })
}

test('two people in one room hear each other, and leaving frees the room', async ({ browser }) => {
  const anna = await (await browser.newContext()).newPage()
  const bob = await (await browser.newContext()).newPage()

  await join(anna, 'Anna')
  await join(bob, 'Bob')

  const annaList = anna.getByRole('list', { name: 'Участники' })
  const bobList = bob.getByRole('list', { name: 'Участники' })
  await expect(annaList).toContainText('Anna (вы)')
  await expect(annaList).toContainText('Bob')
  await expect(bobList).toContainText('Anna')

  // Each side receives sound from the other's (fake) microphone.
  await expect.poll(() => remoteAudioPeak(anna), { timeout: 15_000 }).toBeGreaterThan(0)
  await expect.poll(() => remoteAudioPeak(bob), { timeout: 15_000 }).toBeGreaterThan(0)

  await bob.getByRole('button', { name: 'Выйти' }).click()
  await expect(bob.getByRole('button', { name: 'Войти в комнату' })).toBeVisible()
  await expect(annaList).not.toContainText('Bob')

  await anna.context().close()
  await bob.context().close()
})

test('a shared screen reaches the other participant and stops at once', async ({ browser }) => {
  const screenRoom = `${room}-screen`
  const anna = await (await browser.newContext()).newPage()
  const bob = await (await browser.newContext()).newPage()
  // Keep the captured screen tracks, to imitate the browser's own "Stop sharing" button.
  await anna.addInitScript(() => {
    const original = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices)
    const tracks: MediaStreamTrack[] = []
    Object.assign(window, { __screenTracks: tracks })
    navigator.mediaDevices.getDisplayMedia = async (options) => {
      const stream = await original(options)
      tracks.push(...stream.getVideoTracks())
      return stream
    }
  })
  for (const [page, name] of [
    [anna, 'Anna'],
    [bob, 'Bob'],
  ] as const) {
    await page.goto(`/room/${screenRoom}`)
    await page.getByLabel('Ваше имя').fill(name)
    await page.getByRole('button', { name: 'Войти в комнату' }).click()
    await expect(page.getByText('Вы в комнате')).toBeVisible()
  }
  const bobSeesScreen = bob.getByText('Anna показывает экран')

  await anna.getByRole('button', { name: 'Показать экран' }).click()
  await expect(anna.getByText('Вы показываете экран')).toBeVisible()

  // Bob receives frames, not just an element.
  await expect(bobSeesScreen).toBeVisible({ timeout: 15_000 })
  await expect
    .poll(() => bob.getByLabel('Экран: Anna').evaluate((el: HTMLVideoElement) => el.videoWidth), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0)

  await anna.getByRole('button', { name: 'Остановить показ' }).click()
  await expect(bobSeesScreen).toBeHidden({ timeout: 5_000 })

  // The browser's "Stop sharing" ends the track; the share must stop just the same.
  await anna.getByRole('button', { name: 'Показать экран' }).click()
  await expect(bobSeesScreen).toBeVisible({ timeout: 15_000 })
  await anna.evaluate(() => {
    const { __screenTracks: tracks } = window as unknown as { __screenTracks: MediaStreamTrack[] }
    const track = tracks.at(-1)
    track?.stop()
    track?.dispatchEvent(new Event('ended'))
  })
  await expect(anna.getByRole('button', { name: 'Показать экран' })).toBeVisible()
  await expect(bobSeesScreen).toBeHidden({ timeout: 5_000 })

  await anna.context().close()
  await bob.context().close()
})
