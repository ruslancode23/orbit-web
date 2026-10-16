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
