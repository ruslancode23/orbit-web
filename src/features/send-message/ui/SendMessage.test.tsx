import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Message } from '@/entities/message'
import { renderWithProviders } from '@/shared/lib/test'

import { SendMessage } from './SendMessage'

const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const channelId = '11111111-1111-4111-8111-111111111111'

const anna = {
  id: 'u-anna',
  nickname: 'Anna',
  displayName: 'Anna',
  accentColor: 'slate' as const,
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-10-18T10:00:00Z'),
}
const boris = {
  id: 'u-boris',
  nickname: 'Boris',
  displayName: 'Boris',
  accentColor: 'slate' as const,
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-10-18T10:00:00Z'),
}
const members = [
  { user: anna, role: 'owner', joinedAt: '2026-10-18T10:00:00Z' },
  { user: boris, role: 'member', joinedAt: '2026-10-18T10:00:00Z' },
]

const replyTarget: Message = {
  id: 'm-1',
  channelId,
  seq: 1n,
  kind: 'user',
  content: 'первое сообщение',
  author: anna,
  mentions: [],
  reactions: [],
  createdAt: new Date('2026-10-18T10:00:00Z'),
}

interface Sent {
  clientMessageId: string
  content: string
  replyToId?: string
  mentions?: string[]
}

/** Collects the bodies of the sends; `fail` makes every attempt fail. */
const stubApi = (options: { fail?: boolean } = {}) => {
  const sent: Sent[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      if (request.method === 'POST' && request.url.includes('/messages')) {
        sent.push((await request.clone().json()) as Sent)
        if (options.fail) {
          throw new TypeError('Failed to fetch')
        }
        return json({ ...replyTarget, id: 'm-created', seq: 3n, content: 'сохранённое' })
      }
      if (request.url.includes('/members')) {
        return json(members)
      }
      if (request.url.includes('/auth/me')) {
        return json(anna)
      }
      return json({})
    }),
  )
  return sent
}

const json = (body: unknown) => {
  return new Response(
    JSON.stringify(body, (_key, value: unknown) =>
      typeof value === 'bigint' ? Number(value) : value,
    ),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('sends what was typed and clears the field', async () => {
  const sent = stubApi()
  renderWithProviders(<SendMessage workspaceId={workspaceId} channelId={channelId} />, {
    route: '/',
  })

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
  renderWithProviders(<SendMessage workspaceId={workspaceId} channelId={channelId} />, {
    route: '/',
  })

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
  renderWithProviders(<SendMessage workspaceId={workspaceId} channelId={channelId} />, {
    route: '/',
  })

  await userEvent.type(screen.getByRole('textbox', { name: 'Сообщение' }), 'привет')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Нет соединения с сервером')
})

it('suggests members on @ and inserts the chosen nickname with the keyboard', async () => {
  const sent = stubApi()
  renderWithProviders(<SendMessage workspaceId={workspaceId} channelId={channelId} />, {
    route: '/',
  })

  const field = screen.getByRole('textbox', { name: 'Сообщение' })
  await userEvent.type(field, '@')

  const list = await screen.findByRole('listbox', { name: 'Подсказки упоминаний' })
  // The reader is not offered to mention themselves.
  expect(screen.queryByRole('option', { name: 'Anna' })).not.toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Boris' })).toBeInTheDocument()

  await userEvent.keyboard('{ArrowDown}{Enter}')
  expect(list).not.toBeInTheDocument()
  expect(field).toHaveValue('@Boris ')

  await userEvent.type(field, 'привет')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  await waitFor(() => {
    expect(sent).toHaveLength(1)
  })
  expect(sent[0]?.content).toBe('@Boris привет')
  expect(sent[0]?.mentions).toEqual([boris.id])
})

it('closes the suggestions on Escape and keeps the text', async () => {
  stubApi()
  renderWithProviders(<SendMessage workspaceId={workspaceId} channelId={channelId} />, {
    route: '/',
  })

  const field = screen.getByRole('textbox', { name: 'Сообщение' })
  await userEvent.type(field, '@')
  await screen.findByRole('listbox', { name: 'Подсказки упоминаний' })

  await userEvent.keyboard('{Escape}')

  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(field).toHaveValue('@')
})

it('names the message it answers and clears the reply after sending', async () => {
  const sent = stubApi()
  const onSent = vi.fn()
  renderWithProviders(
    <SendMessage
      workspaceId={workspaceId}
      channelId={channelId}
      replyTo={replyTarget}
      onSent={onSent}
    />,
    { route: '/' },
  )

  expect(screen.getByText(/Ответ на сообщение Anna/)).toBeInTheDocument()

  await userEvent.type(screen.getByRole('textbox', { name: 'Сообщение' }), 'согласен')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  await waitFor(() => {
    expect(sent).toHaveLength(1)
  })
  expect(sent[0]?.replyToId).toBe(replyTarget.id)
  await waitFor(() => {
    expect(onSent).toHaveBeenCalled()
  })
})
