import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Message } from '@/entities/message'
import { renderWithProviders } from '@/shared/lib/test'

import { ChannelChat } from './ChannelChat'

const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const channelId = '11111111-1111-4111-8111-111111111111'

const anna = {
  id: 'u-anna',
  nickname: 'Anna',
  isGuest: false,
  createdAt: new Date('2026-10-18T10:00:00Z'),
}
const boris = {
  id: 'u-boris',
  nickname: 'Boris',
  isGuest: false,
  createdAt: new Date('2026-10-18T10:00:00Z'),
}
const members = [
  { user: anna, role: 'owner', joinedAt: '2026-10-18T10:00:00Z' },
  { user: boris, role: 'member', joinedAt: '2026-10-18T10:00:00Z' },
]

const makeMessage = (
  overrides: Partial<Message> & Pick<Message, 'id' | 'seq' | 'content'>,
): Message => {
  return {
    channelId,
    author: anna,
    mentions: [],
    reactions: [],
    createdAt: new Date('2026-10-18T10:00:00Z'),
    ...overrides,
  }
}

const first = makeMessage({ id: 'm-1', seq: 1n, content: 'первое' })
const second = makeMessage({ id: 'm-2', seq: 2n, content: 'второе' })

interface Posted {
  content: string
  replyToId?: string
}

/**
 * A small stand-in for the API: it keeps the messages it was given, answers
 * mutations with the changed message and counts history reads, so a test can
 * tell a cache update from a refetch.
 */
const stubApi = (initial: Message[] = [second, first], { lastReadSeq = 0 } = {}) => {
  let messages = initial
  const calls = {
    read: [] as number[],
    history: 0,
    posted: [] as Posted[],
    patched: [] as string[],
    deleted: [] as string[],
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      const method = request.method

      if (url.pathname.endsWith('/auth/me')) return json(anna)
      if (url.pathname.endsWith('/members')) return json(members)
      if (url.pathname.endsWith('/unread')) {
        return json([{ channelId, lastReadSeq, unread: 0, mentions: 0 }])
      }
      if (method === 'PUT' && url.pathname.endsWith('/read')) {
        // The server reads seq as a JSON number; a string would be a 400 there.
        const { seq } = (await request.clone().json()) as { seq: unknown }
        if (typeof seq !== 'number') return new Response('{}', { status: 400 })
        calls.read.push(seq)
        return json({ channelId, lastReadSeq: seq, unread: 0, mentions: 0 })
      }

      if (url.pathname.includes('/reactions/')) {
        const emoji = decodeURIComponent(url.pathname.slice(url.pathname.lastIndexOf('/') + 1))
        const target = messages.find((message) => url.pathname.includes(message.id))
        if (!target) return json({})
        const reactions =
          method === 'PUT'
            ? [...target.reactions, { emoji, count: 1, reacted: true }]
            : target.reactions.filter((reaction) => reaction.emoji !== emoji)
        return json(replace(target, { reactions }))
      }

      if (method === 'PATCH' && url.pathname.includes('/messages/')) {
        const body = (await request.clone().json()) as { content: string }
        calls.patched.push(body.content)
        const target = messages.find((message) => url.pathname.includes(message.id))
        if (!target) return json({})
        return json(replace(target, { content: body.content, editedAt: new Date() }))
      }

      if (method === 'DELETE' && url.pathname.includes('/messages/')) {
        const target = messages.find((message) => url.pathname.includes(message.id))
        if (!target) return json({})
        calls.deleted.push(target.id)
        return json(replace(target, { content: '', deletedAt: new Date() }))
      }

      if (method === 'POST' && url.pathname.endsWith('/messages')) {
        calls.posted.push((await request.clone().json()) as Posted)
        return json(second)
      }

      if (method === 'GET' && url.pathname.endsWith('/messages')) {
        calls.history += 1
        return json({ messages })
      }

      return json({})
    }),
  )

  const replace = (target: Message, changes: Partial<Message>): Message => {
    const updated = { ...target, ...changes }
    messages = messages.map((message) => (message.id === target.id ? updated : message))
    return updated
  }

  return calls
}

const json = (body: unknown) => {
  return new Response(
    JSON.stringify(body, (_key, value: unknown) =>
      typeof value === 'bigint' ? Number(value) : value,
    ),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

/**
 * jsdom gives every element zero height, and a virtualized list with no
 * viewport renders no rows. Hand it a window to look through.
 */
const giveViewportSize = () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 400, 600),
  )
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    value: 600,
  })
}

const articleOf = (text: string): HTMLElement => {
  const article = screen.getByText(text).closest('article')
  if (!(article instanceof HTMLElement)) throw new Error(`no article around ${text}`)
  return article
}

const renderChat = (canWrite = true) => {
  giveViewportSize()
  return renderWithProviders(
    <ChannelChat workspaceId={workspaceId} channelId={channelId} canWrite={canWrite} />,
    { route: '/' },
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const setPageHidden = (hidden: boolean) => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(hidden ? 'hidden' : 'visible')
  document.dispatchEvent(new Event('visibilitychange'))
}

it('marks the channel read up to the newest message on screen', async () => {
  const calls = stubApi()
  renderChat()

  await waitFor(() => {
    expect(calls.read).toEqual([2])
  })
})

it('does not mark anything read in a hidden tab, and does once it is shown', async () => {
  setPageHidden(true)
  const calls = stubApi()
  renderChat()
  await screen.findByText('второе')
  // Give the effects a turn: nothing should go out while hidden.
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(calls.read).toEqual([])

  act(() => {
    setPageHidden(false)
  })
  await waitFor(() => {
    expect(calls.read).toEqual([2])
  })
})

it('shows where the new messages begin, skipping my own', async () => {
  const fromBoris = makeMessage({ id: 'm-3', seq: 3n, content: 'от Бориса', author: boris })
  const mine = makeMessage({ id: 'm-4', seq: 4n, content: 'мой ответ' })
  stubApi([mine, fromBoris, second, first], { lastReadSeq: 2 })
  renderChat()
  await screen.findByText('от Бориса')

  const divider = await screen.findByRole('separator', { name: 'Новые сообщения' })
  const log = screen.getByRole('log', { name: 'Сообщения' })
  const order = [...log.querySelectorAll('article, [role="separator"]')].map((node) =>
    node.getAttribute('role') === 'separator' ? '—' : node.textContent,
  )
  const at = order.indexOf('—')
  expect(order[at + 1]).toContain('от Бориса')
  expect(order[at - 1]).toContain('второе')
  expect(divider).toBeInTheDocument()
})

it('shows no divider when everything was read', async () => {
  const read = makeMessage({ id: 'm-2', seq: 2n, content: 'уже прочитано', author: boris })
  stubApi([read, first], { lastReadSeq: 2 })
  renderChat()
  await screen.findByText('уже прочитано')

  expect(screen.queryByRole('separator', { name: 'Новые сообщения' })).not.toBeInTheDocument()
})

it('shows the history oldest first', async () => {
  stubApi()
  renderChat()

  await screen.findByText('первое')
  const log = screen.getByRole('log', { name: 'Сообщения' })
  const texts = [...log.querySelectorAll('article')].map((item) => item.textContent)
  expect(texts.join(' ')).toMatch(/первое[\s\S]*второе/)
})

it('says so when nobody has written yet', async () => {
  stubApi([])
  renderChat()

  expect(await screen.findByText('Здесь пока ничего не написано.')).toBeInTheDocument()
})

it('offers no composer in a read-only channel', async () => {
  stubApi()
  renderChat(false)

  expect(await screen.findByText('В этом канале пишут только администраторы.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Отправить' })).not.toBeInTheDocument()
})

it('puts a reaction into the cache without refetching the history', async () => {
  const calls = stubApi()
  renderChat()
  await screen.findByText('первое')

  const article = articleOf('первое')
  await userEvent.click(within(article).getByRole('button', { name: 'Добавить реакцию' }))
  await userEvent.click(within(article).getByRole('button', { name: 'Поставить реакцию 👍' }))

  expect(
    await screen.findByRole('button', { name: '👍, 1 реакция, вы поставили' }),
  ).toBeInTheDocument()
  expect(calls.history).toBe(1)
})

it('takes a reaction back and removes its chip', async () => {
  stubApi([
    makeMessage({
      id: 'm-5',
      seq: 5n,
      content: 'с реакцией',
      reactions: [{ emoji: '👍', count: 1, reacted: true }],
    }),
  ])
  renderChat()

  const chip = await screen.findByRole('button', { name: '👍, 1 реакция, вы поставили' })
  await userEvent.click(chip)

  await waitFor(() => {
    expect(screen.queryByRole('button', { name: /👍, 1 реакция/ })).not.toBeInTheDocument()
  })
})

it('edits an own message in place', async () => {
  const calls = stubApi()
  renderChat()
  await screen.findByText('первое')

  await userEvent.click(within(articleOf('первое')).getByRole('button', { name: 'Изменить' }))
  const field = screen.getByRole('textbox', { name: 'Редактировать сообщение' })
  await userEvent.clear(field)
  await userEvent.type(field, 'поправка')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

  expect(await screen.findByText('поправка')).toBeInTheDocument()
  expect(calls.patched).toEqual(['поправка'])
  expect(screen.getByText('(изменено)')).toBeInTheDocument()
})

it('deletes an own message after a confirmation', async () => {
  const calls = stubApi()
  renderChat()
  await screen.findByText('первое')

  await userEvent.click(within(articleOf('первое')).getByRole('button', { name: 'Удалить' }))
  const confirmation = screen.getByRole('group', { name: 'Подтверждение удаления' })
  expect(within(confirmation).getByText('Удалить сообщение?')).toBeInTheDocument()
  await userEvent.click(within(confirmation).getByRole('button', { name: 'Удалить' }))

  expect(await screen.findByText('Сообщение удалено')).toBeInTheDocument()
  expect(calls.deleted).toEqual(['m-1'])
})

it("offers no edit or delete on someone else's message", async () => {
  stubApi([second, makeMessage({ id: 'm-3', seq: 3n, content: 'чужое', author: boris })])
  renderChat()
  await screen.findByText('чужое')

  const article = articleOf('чужое')
  expect(within(article).queryByRole('button', { name: 'Изменить' })).not.toBeInTheDocument()
  expect(within(article).queryByRole('button', { name: 'Удалить' })).not.toBeInTheDocument()
  expect(within(article).getByRole('button', { name: 'Ответить' })).toBeInTheDocument()
})

it('answers a message and sends its id', async () => {
  const calls = stubApi()
  renderChat()
  await screen.findByText('первое')

  await userEvent.click(within(articleOf('первое')).getByRole('button', { name: 'Ответить' }))
  expect(screen.getByText(/Ответ на сообщение Anna: первое/)).toBeInTheDocument()

  await userEvent.type(screen.getByRole('textbox', { name: 'Сообщение' }), 'согласен')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  await waitFor(() => {
    expect(calls.posted).toHaveLength(1)
  })
  expect(calls.posted[0]?.replyToId).toBe('m-1')
})

it("marks the reader's mention in the text", async () => {
  stubApi([makeMessage({ id: 'm-9', seq: 9n, content: '@Anna привет', mentions: [anna.id] })])
  renderChat()

  const mention = await screen.findByText('@Anna')
  expect(mention.tagName).toBe('MARK')
})
