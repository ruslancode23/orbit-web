import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'

import { setConversationMuted } from '@/features/notifications'
import { renderWithProviders } from '@/shared/lib/test'

import DirectPage from './DirectPage'

const anna = { id: 'u-anna', nickname: 'Анна', isGuest: false, createdAt: '2026-10-20T10:00:00Z' }
const bob = { id: 'u-bob', nickname: 'Боб', isGuest: false, createdAt: '2026-10-20T10:00:00Z' }
const carol = {
  id: 'u-carol',
  nickname: 'Кэрол',
  isGuest: false,
  createdAt: '2026-10-20T10:00:00Z',
}
const dave = { id: 'u-dave', nickname: 'Дэйв', isGuest: false, createdAt: '2026-10-20T10:00:00Z' }

const direct = {
  id: 'c-direct',
  kind: 'direct',
  members: [anna, bob],
  createdAt: '2026-10-20T10:00:00Z',
}
const group = {
  id: 'c-group',
  kind: 'group',
  name: 'Планы',
  members: [anna, bob, carol],
  createdAt: '2026-10-20T11:00:00Z',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

interface StubOptions {
  detail?: unknown
  detailStatus?: number
  friends?: unknown[]
  renameStatus?: number
  addStatus?: number
  blocks?: { id: string; nickname: string; createdAt: string }[]
  sendStatus?: number
}

interface StubState {
  calls: string[]
  renameBodies: unknown[]
  memberBodies: unknown[]
  blocks: { id: string; nickname: string; createdAt: string }[]
}

/**
 * The page uses the chat widget, which asks for the history of the channel id.
 * A conversation id is a channel id, so the same stub answers both.
 */
const stubApi = ({
  detail = direct,
  detailStatus = 200,
  friends = [],
  renameStatus = 200,
  addStatus = 200,
  blocks = [],
  sendStatus = 200,
}: StubOptions = {}): StubState => {
  const state: StubState = { calls: [], renameBodies: [], memberBodies: [], blocks: [...blocks] }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      state.calls.push(`${request.method} ${url.pathname}`)
      if (url.pathname.endsWith('/auth/me')) {
        return json(anna)
      }
      if (url.pathname === '/api/v1/friends') {
        return json(friends)
      }
      if (url.pathname === '/api/v1/friends/requests') {
        return json([])
      }
      if (url.pathname === '/api/v1/users/me/blocks') {
        return json(state.blocks)
      }
      if (url.pathname.startsWith('/api/v1/users/me/blocks/')) {
        const id = url.pathname.split('/').at(-1)
        state.blocks = state.blocks.filter((user) => user.id !== id)
        return new Response(null, { status: 204 })
      }
      if (url.pathname === '/api/v1/conversations/unread') {
        return json({ unread: 0, mentions: 0 })
      }
      if (url.pathname === '/api/v1/conversations') {
        return json({ conversations: [] })
      }
      if (url.pathname === '/api/v1/conversations/c-direct') {
        return detailStatus === 200
          ? json(direct)
          : json({ error: { code: 'not_found', message: 'no conversation' } }, detailStatus)
      }
      if (url.pathname === '/api/v1/conversations/c-group') {
        if (request.method === 'PATCH') {
          const body = (await request.clone().json()) as { name: string }
          state.renameBodies.push(body)
          if (renameStatus !== 200) {
            return json({ error: { code: 'conflict', message: 'not a group' } }, renameStatus)
          }
          return json({ ...group, name: body.name })
        }
        return detailStatus === 200
          ? json(detail)
          : json({ error: { code: 'not_found', message: 'no conversation' } }, detailStatus)
      }
      if (url.pathname === '/api/v1/conversations/c-group/members') {
        const body = (await request.clone().json()) as { userIds: string[] }
        state.memberBodies.push(body)
        if (addStatus !== 200) {
          return json({ error: { code: 'conflict', message: 'not a group' } }, addStatus)
        }
        return json({ ...group, members: [...group.members, dave] })
      }
      if (url.pathname === '/api/v1/conversations/c-group/members/me') {
        return new Response(null, { status: 204 })
      }
      if (url.pathname.startsWith('/api/v1/conversations/')) {
        return detailStatus === 200
          ? json(detail)
          : json({ error: { code: 'not_found', message: 'no conversation' } }, detailStatus)
      }
      if (url.pathname === '/api/v1/workspaces') {
        return json([])
      }
      if (url.pathname.endsWith('/unread')) {
        return json([])
      }
      if (url.pathname.endsWith('/members')) {
        return json([])
      }
      if (url.pathname.endsWith('/messages')) {
        if (request.method === 'POST' && sendStatus !== 200) {
          return json({ error: { code: 'not_found', message: 'not found' } }, sendStatus)
        }
        return json({ messages: [] })
      }
      return json({})
    }),
  )
  return state
}

const renderPage = (route = '/me', { withList = false } = {}) =>
  renderWithProviders(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        {withList && <Route path="/me" element={<p>список бесед</p>} />}
        <Route path="/me" element={<DirectPage />} />
        <Route path="/me/friends" element={<DirectPage />} />
        <Route path="/me/:conversationId" element={<DirectPage />} />
      </Routes>
    </MemoryRouter>,
  )

afterEach(() => {
  setConversationMuted('c-direct', false)
  vi.unstubAllGlobals()
})

it('opens the friends section by default at /me', async () => {
  stubApi()
  renderPage('/me')

  expect(await screen.findByRole('heading', { name: 'Друзья', level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Добавить в друзья' })).toBeInTheDocument()
})

it('opens the friends section at the explicit /me/friends route', async () => {
  stubApi()
  renderPage('/me/friends')

  expect(await screen.findByRole('heading', { name: 'Друзья', level: 1 })).toBeInTheDocument()
  // The static segment is not read as a dialogue id.
  expect(screen.queryByRole('region', { name: 'Чат' })).not.toBeInTheDocument()
})

it('opens a pair dialogue with the peer and the usual composer', async () => {
  stubApi()
  renderPage('/me/c-direct')

  expect(await screen.findByRole('heading', { name: 'Боб', level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Чат' })).toBeInTheDocument()
  const composer = screen.getByLabelText('Сообщение')
  expect(composer).toHaveAttribute('placeholder', 'Написать в #Боб')
  expect(screen.getByRole('button', { name: 'Прикрепить файл' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Добавить людей' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Действия с группой' })).not.toBeInTheDocument()
})

it('replaces the composer with the state of a blocked peer and unblocks from it', async () => {
  const state = stubApi({
    blocks: [{ id: bob.id, nickname: 'Боб', createdAt: '2026-10-20T10:00:00Z' }],
  })
  renderPage('/me/c-direct')

  expect(await screen.findByText('Вы заблокировали пользователя')).toBeInTheDocument()
  expect(screen.queryByLabelText('Сообщение')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Разблокировать' }))

  await waitFor(() => {
    expect(state.calls).toContain('DELETE /api/v1/users/me/blocks/u-bob')
  })
  expect(await screen.findByLabelText('Сообщение')).toBeInTheDocument()
  expect(screen.queryByText('Вы заблокировали пользователя')).not.toBeInTheDocument()
})

it('explains a send refused with 404 as a blocked dialogue, not a network failure', async () => {
  stubApi({ sendStatus: 404 })
  renderPage('/me/c-direct')

  await userEvent.type(await screen.findByLabelText('Сообщение'), 'привет')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  expect(await screen.findByText(/Пользователь недоступен/)).toBeInTheDocument()
  expect(screen.queryByText('Нет соединения с сервером.')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Сообщение')).not.toBeInTheDocument()
})

it('turns the notifications of one dialogue off and on from its menu', async () => {
  stubApi()
  renderPage('/me/c-direct')

  await screen.findByRole('heading', { name: 'Боб', level: 1 })
  await userEvent.click(screen.getByRole('button', { name: 'Действия с диалогом' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Выключить уведомления' }))

  await userEvent.click(screen.getByRole('button', { name: 'Действия с диалогом' }))
  expect(await screen.findByRole('menuitem', { name: 'Включить уведомления' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('menuitem', { name: 'Включить уведомления' }))
  await userEvent.click(screen.getByRole('button', { name: 'Действия с диалогом' }))
  expect(await screen.findByRole('menuitem', { name: 'Выключить уведомления' })).toBeInTheDocument()
})

it('names a group by its title and offers the group actions', async () => {
  stubApi({ detail: group })
  renderPage('/me/c-group')

  expect(await screen.findByRole('heading', { name: 'Планы', level: 1 })).toBeInTheDocument()
  expect(screen.getByText('3 участника: Боб, Кэрол')).toBeInTheDocument()
  const add = screen.getByRole('button', { name: 'Добавить людей' })
  expect(add).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Действия с группой' })).toBeInTheDocument()
  expect(screen.getByLabelText('Сообщение')).toHaveAttribute('placeholder', 'Написать в #Планы')
})

it('suggests the group members after @', async () => {
  stubApi({ detail: group })
  renderPage('/me/c-group')

  await screen.findByRole('heading', { name: 'Планы', level: 1 })
  await userEvent.type(screen.getByLabelText('Сообщение'), '@')

  const hints = await screen.findByRole('listbox', { name: 'Подсказки упоминаний' })
  expect(within(hints).getByRole('option', { name: 'Боб' })).toBeInTheDocument()
  expect(within(hints).getByRole('option', { name: 'Кэрол' })).toBeInTheDocument()
  expect(within(hints).queryByRole('option', { name: 'Анна' })).not.toBeInTheDocument()
})

it('renames a group from its menu', async () => {
  const state = stubApi({ detail: group })
  renderPage('/me/c-group')

  await screen.findByRole('heading', { name: 'Планы', level: 1 })
  await userEvent.click(screen.getByRole('button', { name: 'Действия с группой' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Переименовать' }))

  const dialog = await screen.findByRole('dialog', { name: 'Переименовать группу' })
  const field = within(dialog).getByLabelText('Название группы')
  await userEvent.clear(field)
  await userEvent.type(field, 'Новая команда')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

  await waitFor(() => {
    expect(state.renameBodies).toEqual([{ name: 'Новая команда' }])
  })
  expect(
    await screen.findByRole('heading', { name: 'Новая команда', level: 1 }),
  ).toBeInTheDocument()
})

it('adds a friend to a group', async () => {
  const state = stubApi({
    detail: group,
    friends: [{ id: dave.id, nickname: 'Дэйв', presence: 'online', since: '2026-10-20T10:00:00Z' }],
  })
  renderPage('/me/c-group')

  await screen.findByRole('heading', { name: 'Планы', level: 1 })
  await userEvent.click(screen.getByRole('button', { name: 'Добавить людей' }))

  const dialog = await screen.findByRole('dialog', { name: 'Добавить людей' })
  await userEvent.click(await within(dialog).findByRole('checkbox', { name: 'Дэйв' }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Добавить' }))

  await waitFor(() => {
    expect(state.memberBodies).toEqual([{ userIds: [dave.id] }])
  })
  expect(await screen.findByText('4 участника: Боб, Кэрол, Дэйв')).toBeInTheDocument()
})

it('leaves a group and returns to the list', async () => {
  const state = stubApi({ detail: group })
  renderPage('/me/c-group', { withList: true })

  await screen.findByRole('heading', { name: 'Планы', level: 1 })
  await userEvent.click(screen.getByRole('button', { name: 'Действия с группой' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Выйти из группы' }))

  const dialog = await screen.findByRole('dialog', { name: 'Выйти из группы' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Выйти' }))

  expect(await screen.findByText('список бесед')).toBeInTheDocument()
  expect(state.calls).toContain('DELETE /api/v1/conversations/c-group/members/me')
})

it('explains a 409 when the server refuses a group action on a dialogue', async () => {
  stubApi({ detail: group, renameStatus: 409 })
  renderPage('/me/c-group')

  await screen.findByRole('heading', { name: 'Планы', level: 1 })
  await userEvent.click(screen.getByRole('button', { name: 'Действия с группой' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Переименовать' }))

  const dialog = await screen.findByRole('dialog', { name: 'Переименовать группу' })
  const field = within(dialog).getByLabelText('Название группы')
  await userEvent.clear(field)
  await userEvent.type(field, 'Новая команда')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Это личный диалог, создайте группу.',
  )
  expect(screen.getByRole('dialog', { name: 'Переименовать группу' })).toBeInTheDocument()
})

it('says a missing dialogue is missing and leads back', async () => {
  stubApi({ detailStatus: 404 })
  renderPage('/me/c-direct')

  expect(await screen.findByRole('heading', { name: 'Диалог не найден' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'К личным сообщениям' })).toHaveAttribute('href', '/me')
})

it('offers a secret chat in the menu of a pair dialogue', async () => {
  stubApi()
  renderPage('/me/c-direct')

  await screen.findByRole('heading', { name: 'Боб', level: 1 })
  await userEvent.click(screen.getByRole('button', { name: 'Действия с диалогом' }))

  expect(await screen.findByRole('menuitem', { name: 'Секретный чат' })).toBeInTheDocument()
})

it('has no secret chat for a group', async () => {
  stubApi({ detail: group })
  renderPage('/me/c-group')

  await screen.findByRole('heading', { name: 'Планы', level: 1 })
  expect(screen.queryByRole('button', { name: 'Действия с диалогом' })).not.toBeInTheDocument()
})
