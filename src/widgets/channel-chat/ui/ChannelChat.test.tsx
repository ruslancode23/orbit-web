import { screen } from '@testing-library/react'

import { renderWithProviders } from '@/shared/lib/test'

import { ChannelChat } from './ChannelChat'

const channelId = '11111111-1111-4111-8111-111111111111'
const anna = { id: 'u-anna', nickname: 'Anna', isGuest: false, createdAt: '2026-10-18T10:00:00Z' }

const page = {
  messages: [
    {
      id: 'm-2',
      channelId,
      seq: 2,
      content: 'второе',
      author: anna,
      mentions: [],
      attachments: [],
      createdAt: '2026-10-18T10:01:00Z',
    },
    {
      id: 'm-1',
      channelId,
      seq: 1,
      content: 'первое',
      author: anna,
      mentions: [],
      attachments: [],
      createdAt: '2026-10-18T10:00:00Z',
    },
  ],
}

function stubApi(body: unknown = page) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const { url } = input as Request
      await Promise.resolve()
      return new Response(JSON.stringify(url.includes('/auth/me') ? anna : body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
}

/**
 * jsdom gives every element zero height, and a virtualized list with no
 * viewport renders no rows. Hand it a window to look through.
 */
function giveViewportSize() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 400, 600),
  )
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    value: 600,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('shows the history oldest first', async () => {
  stubApi()
  giveViewportSize()
  renderWithProviders(<ChannelChat channelId={channelId} canWrite />, { route: '/' })

  await screen.findByText('первое')
  const log = screen.getByRole('log', { name: 'Сообщения' })
  const texts = [...log.querySelectorAll('article')].map((item) => item.textContent)
  expect(texts.join(' ')).toMatch(/первое[\s\S]*второе/)
})

it('says so when nobody has written yet', async () => {
  stubApi({ messages: [] })
  renderWithProviders(<ChannelChat channelId={channelId} canWrite />, { route: '/' })

  expect(await screen.findByText('Здесь пока ничего не написано.')).toBeInTheDocument()
})

it('offers no composer in a read-only channel', async () => {
  stubApi()
  renderWithProviders(<ChannelChat channelId={channelId} canWrite={false} />, { route: '/' })

  expect(await screen.findByText('В этом канале пишут только администраторы.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Отправить' })).not.toBeInTheDocument()
})
