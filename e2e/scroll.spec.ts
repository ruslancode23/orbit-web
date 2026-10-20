import { expect, test, type APIRequestContext } from '@playwright/test'

const API_URL = process.env.VITE_API_URL ?? 'http://localhost:8080'
const password = 'a-long-enough-password'
const unique = (prefix: string) =>
  `${prefix}${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`

// A 320×180 PNG: tall enough that the message list only settles after it decodes.
const IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAUAAAAC0CAIAAABqhmJGAAAFFUlEQVR4nO3YwW3kRhAFUI6icSSKRCdF4BAcwcakEHzYIByCsaBhC5Y06uFwyPrV790LAj7qd3F0+fnzr2VZXv/4c7ndj99/Mysru7Gc14WnDTNAEU9r79c34FZmZWU3zu2CCwzBfhXYIR0nK1mV2g0XGIL9U2CHZZysZFVnN1xgCPZfgR2WcbKSVZHdcIEhmAJDlwL7MhwnK1lV2A0XGIL9v8AOyzhZyer03XCBIdgnBXZYxslKVufuhgsMwT4vsMMyTlayOnE3XGAIpsDQscC+DMfJSlZn7YYLDMGuFdhhGScrWZ2yGy4wBPumwA7LOFnJ6vjdcIEh2PcFdljGyUpWB++GCwzBFBi6F9iX4ThZyerI3XCBIdhogR2WcbKS1WG74QJDsBsK7LDIym5U64ILDMGeQh8es7JaTb4bLjAEU2CYqcBFvhzMyupfM++GCwzBLs8vbxvG1vavL4FZWdmN15O64AJDsI0FrvD1b1ZW7825Gy4wzPcbeOWXsKzsxrldcIEhmALDrAXO/elvVlY9dsMFhmD3Fjjx0TIrqza74QJDsB0KHPdomZVVm71ygSHYPgXOerTMyqrNXrnAEEyBIdhuBQ766jArqzZ75QJDsD0LnPJomZVVm71ygSHYzgWOeLTMyqrNXrnAEGz/Atd/tMzKqk1WLjAEU2AI9pACF//qMCurNnvlAkOwRxW48qNlVlZt9soFhmAPLHDZR8usrJYuu+ECQ7DHFrjmo2VWVj+67IYLDMEUGII9vMAFvzrMymrpshsuMAQ7osDVHi2zsnrtshsuMAQ7qMClHi2zslq67IYLDMGOK3CdR8usrNrshgsMwRQYgh1a4CJfHWZl1WY3XGAIdnl+eTv4T64vx/qKmJWV3Xi9owsuMAQ7ocAVfjmYlVWP3XCBIdgJv4FXfgnLym7c3wUXGIIpMAQ7rcC5/zYwK6s6u+ECQ7AzC+ygycpu3NkFFxiCnVxgR1hWduOeLrjAEOz8AjvCsrIbm7twfoGBzRQYgpUosK9oWdmNbV0oUWBgmyoFdoRlZTc2dKFKgYENChXYEZaV3bi1C4UKDNyqVoEdYVnZjZu6UKvAwE0UGIKVK7CvaFnZjfEulCswMK5igR1hWdmNwS5ULDAwqGiBHWFZ2Y2RLhQtMDCiboEdYVnZjW+7ULfAwLcUGIKVLrCvaFnZjetdKF1g4LrqBXaEZWU3rnSheoGBKwIK7AjLym581YWAAgNfySiwIywru/FpFzIKDHxKgSFYTIF9RcvKbnzsQkyBgY8uzy9vS4711VlfILOyem/O3XCBIVhYgf0SlpXdeN+FsAIDwb+B03+xmJXVvrvhAkMwBYZgkQX2ryxZ2Y3gAgPZBXaEZfWVqXYjtcBAdoHjHkuzstp9r4ILDGQX2DGU1eS7kV1gmJwCQ7D4Agd97ZiV1e57FV9gmFmHAjuGspp2NzoUGKbVpMARj6VZWe2+V00KDHPqU2DHUFYT7kafAsOEFBiCtSpw8a8ds7Lafa9aFRhm063AjqGsptqNbgWGqTQscNnH0qyslr13o2GBYR49C+wYymqS3ehZYJiEAkOwtgUu+LVjVlbL3rvRtsAwg84Fdgxl1X43OhcY2mte4FKPpVlZLXvvRvMCQ2/9C+wYyqrxbvQvMDSmwBBsigIX+doxK6vdd2OKAkNXl+eXt2UO64u1vl5mZdVjN1xgCDZRgf0ilVW/3ZiowNDPRL+B03/tmJXV8sHfgXa/JdGqL58AAAAASUVORK5CYII=',
  'base64',
)

async function post<T>(api: APIRequestContext, path: string, data?: object): Promise<T> {
  const response = await api.post(`${API_URL}/api/v1${path}`, data ? { data } : {})
  expect(response.ok(), `${path} answered ${String(response.status())}`).toBe(true)
  return (await response.json()) as T
}

test('the document never scrolls while the channel column and the feed do', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  await post(context.request, '/auth/register', { nickname: unique('scroll'), password })
  const { workspace } = await post<{ workspace: { id: string } }>(context.request, '/workspaces', {
    name: 'Скролл',
  })

  // A long channel column: it must scroll inside itself, not stretch the page.
  for (let index = 1; index <= 24; index += 1) {
    await post(context.request, `/workspaces/${workspace.id}/channels`, {
      name: `канал-${String(index)}`,
    })
  }
  const channel = await post<{ id: string }>(
    context.request,
    `/workspaces/${workspace.id}/channels`,
    { name: 'общий' },
  )

  for (let index = 1; index <= 40; index += 1) {
    await post(context.request, `/channels/${channel.id}/messages`, {
      clientMessageId: crypto.randomUUID(),
      content: `сообщение номер ${String(index)}`,
    })
  }

  // An image last: its height arrives after the text, and the list must stay pinned.
  const upload = await context.request.post(
    `${API_URL}/api/v1/channels/${channel.id}/attachments`,
    { multipart: { file: { name: 'скролл.png', mimeType: 'image/png', buffer: IMAGE } } },
  )
  expect(upload.ok(), 'the image was uploaded').toBe(true)
  const attachment = (await upload.json()) as { id: string }
  await post(context.request, `/channels/${channel.id}/messages`, {
    clientMessageId: crypto.randomUUID(),
    content: 'картинка внизу',
    attachmentIds: [attachment.id],
  })

  const page = await context.newPage()
  await page.goto(`/s/${workspace.id}/${channel.id}`)
  await expect(page.getByRole('img', { name: 'скролл.png' })).toBeVisible()

  const documentSize = await page.evaluate(() => {
    const root = document.scrollingElement
    return {
      scrollHeight: root?.scrollHeight ?? 0,
      clientHeight: root?.clientHeight ?? 0,
      scrollTop: root?.scrollTop ?? 0,
      innerHeight: window.innerHeight,
    }
  })
  expect(documentSize.scrollHeight).toBe(documentSize.innerHeight)
  expect(documentSize.scrollHeight).toBe(documentSize.clientHeight)
  expect(documentSize.scrollTop).toBe(0)

  // The channel column has its own scrollbar and actually needs one.
  const columnScrolls = await page
    .getByRole('complementary', { name: 'Каналы' })
    .evaluate((channels) => {
      return [...channels.querySelectorAll('*')].some((node) => {
        const element = node instanceof HTMLElement ? node : null
        if (!element) {
          return false
        }
        const style = getComputedStyle(element)
        return style.overflowY === 'auto' && element.scrollHeight > element.clientHeight + 1
      })
    })
  expect(columnScrolls).toBe(true)

  // After the history and the picture, the feed sits exactly at its end: no gap.
  const log = page.getByRole('log', { name: 'Сообщения' })
  await expect
    .poll(() =>
      log.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight),
    )
    .toBeLessThanOrEqual(2)

  await context.close()
})
