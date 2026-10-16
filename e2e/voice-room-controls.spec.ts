import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join as joinPath } from 'node:path'

import { expect, test, type Page } from '@playwright/test'

/**
 * A steady tone instead of Chrome's default fake microphone, which only beeps briefly twice a second:
 * with it "speech" starts exactly when the microphone is unmuted, so the delay can be measured.
 */
function writeToneWav(): string {
  const sampleRate = 48_000
  const seconds = 10
  const samples = sampleRate * seconds
  const wav = Buffer.alloc(44 + samples * 2)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + samples * 2, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20) // PCM
  wav.writeUInt16LE(1, 22) // mono
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(samples * 2, 40)
  for (let i = 0; i < samples; i++) {
    wav.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 16_000),
      44 + i * 2,
    )
  }
  const path = joinPath(tmpdir(), 'orbit-e2e-tone.wav')
  writeFileSync(path, wav)
  return path
}

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${writeToneWav()}`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  },
})

// Unique room per test: a participant who just left can linger in the room for a moment.
const runId = Date.now().toString(36)

async function join(page: Page, name: string) {
  await page.goto(`/room/e2e-${runId}-${test.info().testId.slice(-10)}`)
  await page.getByLabel('Ваше имя').fill(name)
  await page.getByRole('button', { name: 'Войти в комнату' }).click()
  await expect(page.getByText('Вы в комнате')).toBeVisible()
}

const card = (page: Page, name: string) =>
  page.getByRole('list', { name: 'Участники' }).getByRole('listitem').filter({ hasText: name })

const median = (values: number[]) => {
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN
}

// Needs LiveKit with orbit-server's deploy/livekit.yaml (speaker updates every 100 ms):
// with LiveKit defaults the indicator takes 250–450 ms.
test('the speaking indicator lights up within 300 ms of speech', async ({ browser }) => {
  const anna = await (await browser.newContext()).newPage()
  const bob = await (await browser.newContext()).newPage()
  await join(anna, 'Anna')
  await join(bob, 'Bob')
  const annaOnBob = card(bob, 'Anna').locator('[data-speaking]')
  await expect(annaOnBob).toHaveAttribute('data-speaking', 'true', { timeout: 15_000 })

  // Bob's page notes when Anna's indicator lights up, by its own clock (the same machine clock).
  await annaOnBob.evaluate((element) => {
    const state = window as unknown as { __litAt: number | null }
    state.__litAt = null
    new MutationObserver(() => {
      if (element.getAttribute('data-speaking') === 'true') state.__litAt ??= Date.now()
    }).observe(element, { attributes: true, attributeFilter: ['data-speaking'] })
  })

  const mute = anna.getByRole('button', { name: 'Выключить микрофон' })
  const delays: number[] = []
  for (let i = 0; i < 5; i++) {
    await mute.click()
    await expect(annaOnBob).toHaveAttribute('data-speaking', 'false', { timeout: 10_000 })
    await bob.evaluate(() => {
      Object.assign(window, { __litAt: null })
    })

    const startedAt = Date.now()
    await mute.click() // The tone is steady: speech starts the moment the microphone is back.
    await expect
      .poll(() => bob.evaluate(() => (window as unknown as { __litAt: number | null }).__litAt), {
        timeout: 10_000,
      })
      .not.toBeNull()
    const litAt = await bob.evaluate(() => (window as unknown as { __litAt: number }).__litAt)
    delays.push(litAt - startedAt)
  }

  test.info().annotations.push({ type: 'speaking delays, ms', description: delays.join(', ') })
  console.log(
    `speaking indicator delays, ms: ${delays.join(', ')}; median ${String(median(delays))}`,
  )
  expect(median(delays)).toBeLessThan(300)

  await anna.context().close()
  await bob.context().close()
})

test('mute and deafen are visible to the other participant', async ({ browser }) => {
  const anna = await (await browser.newContext()).newPage()
  const bob = await (await browser.newContext()).newPage()
  await join(anna, 'Anna')
  await join(bob, 'Bob')
  const annaOnBob = card(bob, 'Anna')
  await expect(annaOnBob).not.toContainText('выключен')

  await anna.getByRole('button', { name: 'Выключить микрофон' }).press('Enter')
  await expect(annaOnBob).toContainText('Anna, микрофон выключен')
  await anna.getByRole('button', { name: 'Выключить микрофон' }).press('Space')
  await expect(annaOnBob).not.toContainText('выключен')

  // Anna hears nobody: every remote audio element she plays is at zero.
  const volumes = (page: Page) =>
    page.evaluate(() => [...document.querySelectorAll('audio')].map((el) => el.volume))
  await expect.poll(() => volumes(anna), { timeout: 15_000 }).toEqual([1])

  await anna.getByRole('button', { name: 'Выключить звук' }).click()
  await expect(annaOnBob).toContainText('Anna, звук выключен')
  await expect.poll(() => volumes(anna)).toEqual([0])
  await expect(anna.getByRole('button', { name: 'Выключить микрофон' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await anna.getByRole('button', { name: 'Выключить звук' }).click()
  await expect(annaOnBob).not.toContainText('выключен')
  await expect.poll(() => volumes(anna)).toEqual([1])

  // Bob turns Anna down for himself only.
  const slider = bob.getByRole('slider', { name: 'Громкость: Anna' })
  await slider.focus()
  await slider.press('Home')
  await expect(slider).toHaveAttribute('aria-valuetext', '0 %')
  await expect.poll(() => volumes(bob)).toEqual([0])
  await expect.poll(() => volumes(anna)).toEqual([1])

  await anna.context().close()
  await bob.context().close()
})
