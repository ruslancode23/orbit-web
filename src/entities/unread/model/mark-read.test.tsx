import { QueryClient } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { listUnreadQueryKey, type ChannelUnread } from '@/shared/api'
import { renderWithProviders } from '@/shared/lib/test'

import { useMarkChannelsRead } from './unread'

const workspaceId = '0b7e6c1a-2f4d-4c1e-9a3b-5d6e7f8a9b0c'
const unreadChannel = '11111111-1111-4111-8111-111111111111'
const readChannel = '22222222-2222-4222-8222-222222222222'

const json = (body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }),
  )

const stubApi = () => {
  const fetch = vi.fn(async (request: Request) => {
    if (request.method === 'GET' && request.url.includes('/messages')) {
      return json({
        messages: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            channelId: unreadChannel,
            seq: 42,
            kind: 'text',
            content: 'привет',
            mentions: [],
            reactions: [],
            createdAt: '2026-10-22T10:00:00Z',
          },
        ],
      })
    }
    const body: unknown = await request.json()
    expect(body).toEqual({ seq: 42 })
    return json({ channelId: unreadChannel, lastReadSeq: 42, unread: 0, mentions: 0 })
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const MarkAll = () => {
  const mark = useMarkChannelsRead(workspaceId)
  return (
    <button
      type="button"
      onClick={() => {
        mark.mutate([unreadChannel, readChannel])
      }}
    >
      {mark.isSuccess ? 'Готово' : 'Прочитать'}
    </button>
  )
}

it('moves the cursor up to the newest message, only where something is unread', async () => {
  const fetch = stubApi()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const key = listUnreadQueryKey({ path: { workspaceId } })
  queryClient.setQueryData<ChannelUnread[]>(key, [
    { channelId: unreadChannel, lastReadSeq: 10n, unread: 3, mentions: 1 },
    { channelId: readChannel, lastReadSeq: 5n, unread: 0, mentions: 0 },
  ])

  renderWithProviders(<MarkAll />, { queryClient })
  await userEvent.click(screen.getByRole('button', { name: 'Прочитать' }))

  await screen.findByRole('button', { name: 'Готово' })
  const urls = fetch.mock.calls.map(([request]) => `${request.method} ${request.url}`)
  expect(urls).toHaveLength(2)
  expect(urls[0]).toContain(`GET`)
  expect(urls[0]).toContain(`/channels/${unreadChannel}/messages?limit=1`)
  expect(urls[1]).toContain(`/channels/${unreadChannel}/read`)
  await waitFor(() => {
    expect(
      queryClient.getQueryData<ChannelUnread[]>(key)?.find((c) => c.channelId === unreadChannel)
        ?.unread,
    ).toBe(0)
  })
})
