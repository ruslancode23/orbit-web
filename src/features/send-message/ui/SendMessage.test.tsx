import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/shared/lib/test'

import { SendMessage } from './SendMessage'

const channelId = '11111111-1111-4111-8111-111111111111'

interface Sent {
  clientMessageId: string
  content: string
}

/** Collects the bodies of the sends; `fail` makes every attempt fail. */
function stubApi(options: { fail?: boolean } = {}) {
  const sent: Sent[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      if (request.method === 'POST' && request.url.includes('/messages')) {
        sent.push((await request.clone().json()) as Sent)
        if (options.fail) throw new TypeError('Failed to fetch')
      }
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
  return sent
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('sends what was typed and clears the field', async () => {
  const sent = stubApi()
  renderWithProviders(<SendMessage channelId={channelId} />, { route: '/' })

  const field = screen.getByRole('textbox', { name: 'Сообщение' })
  await userEvent.type(field, 'привет')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  await waitFor(() => {
    expect(sent).toHaveLength(1)
  })
  expect(sent[0]?.content).toBe('привет')
  expect(sent[0]?.clientMessageId).not.toBe('')
  expect(field).toHaveValue('')
})

// The server treats the client id as the identity of the message, so a repeat
// of the same id is the same message and not a second one.
it('repeats a failed send with the same client id', async () => {
  const sent = stubApi({ fail: true })
  renderWithProviders(<SendMessage channelId={channelId} />, { route: '/' })

  await userEvent.type(screen.getByRole('textbox', { name: 'Сообщение' }), 'привет')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  await screen.findByRole('alert')
  await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))

  await waitFor(() => {
    expect(sent).toHaveLength(2)
  })
  expect(sent[1]?.clientMessageId).toBe(sent[0]?.clientMessageId)
})

it('tells the reader when there is no connection', async () => {
  stubApi({ fail: true })
  renderWithProviders(<SendMessage channelId={channelId} />, { route: '/' })

  await userEvent.type(screen.getByRole('textbox', { name: 'Сообщение' }), 'привет')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Нет соединения с сервером')
})
