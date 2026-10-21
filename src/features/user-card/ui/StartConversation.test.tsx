import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router'

import { renderWithProviders } from '@/shared/lib/test'

import { StartConversation } from './StartConversation'

const workspaceId = 'w-1'

const anna = {
  id: 'u-anna',
  nickname: 'anna',
  displayName: 'Анна',
  accentColor: 'slate',
  bio: '',
  isGuest: false,
  createdAt: '2026-10-20T10:00:00Z',
}
const bob = {
  id: 'u-bob',
  nickname: 'bob',
  displayName: 'Боб',
  accentColor: 'violet',
  bio: '',
  isGuest: false,
  createdAt: '2026-10-20T10:00:00Z',
}
const carol = {
  id: 'u-carol',
  nickname: 'carol',
  displayName: 'Кэрол',
  accentColor: 'teal',
  bio: '',
  isGuest: false,
  createdAt: '2026-10-20T10:00:00Z',
}
const dave = {
  id: 'u-dave',
  nickname: 'dave',
  displayName: 'Дэйв',
  accentColor: 'amber',
  bio: '',
  isGuest: false,
  createdAt: '2026-10-20T10:00:00Z',
}

const direct = {
  id: 'c-direct',
  kind: 'direct',
  members: [anna, bob],
  createdAt: '2026-10-20T10:00:00Z',
}
const group = {
  id: 'c-group',
  kind: 'group',
  members: [anna, bob, carol],
  createdAt: '2026-10-20T10:00:00Z',
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

interface StubOptions {
  startStatus?: number
  startMessage?: string
  retryAfter?: string
}

const stubApi = ({
  startStatus = 200,
  startMessage = 'conflict',
  retryAfter,
}: StubOptions = {}) => {
  const state = { posted: [] as string[], renamed: [] as string[] }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      if (url.pathname.endsWith('/auth/me')) {
        return json(anna)
      }
      if (url.pathname === '/api/v1/workspaces') {
        return json([
          {
            workspace: {
              id: workspaceId,
              name: 'Команда',
              description: null,
              iconUrl: null,
              memberPermissions: {
                canInvite: false,
                canCreateChannels: false,
                canAttachFiles: true,
              },
              ownerId: anna.id,
              createdAt: '2026-10-20T10:00:00Z',
            },
            role: 'member',
          },
        ])
      }
      if (url.pathname === `/api/v1/workspaces/${workspaceId}/members`) {
        return json(
          [anna, bob, carol, dave].map((user) => ({
            user,
            role: 'member',
            joinedAt: '2026-10-20T10:00:00Z',
          })),
        )
      }
      if (url.pathname === '/api/v1/conversations' && request.method === 'POST') {
        const body = (await request.clone().json()) as { userIds: string[] }
        state.posted.push(JSON.stringify(body))
        if (startStatus !== 200) {
          return json(
            { error: { code: 'conflict', message: startMessage } },
            startStatus,
            retryAfter === undefined ? {} : { 'Retry-After': retryAfter },
          )
        }
        return body.userIds.length === 1 ? json(direct) : json(group, 201)
      }
      if (url.pathname === '/api/v1/conversations/c-group' && request.method === 'PATCH') {
        const body = (await request.clone().json()) as { name: string }
        state.renamed.push(body.name)
        return json({ ...group, name: body.name })
      }
      return json({})
    }),
  )
  return state
}

const ConversationProbe = () => {
  const { conversationId } = useParams()
  return <p>Диалог {conversationId}</p>
}

const renderFeature = () =>
  renderWithProviders(
    <MemoryRouter initialEntries={['/me']}>
      <Routes>
        <Route path="/me" element={<StartConversation />} />
        <Route path="/me/:conversationId" element={<ConversationProbe />} />
      </Routes>
    </MemoryRouter>,
  )

const openDialog = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Написать' }))
  return screen.findByRole('dialog', { name: 'Новое сообщение' })
}

const choose = async (dialog: HTMLElement, name: string) => {
  await userEvent.click(within(dialog).getByRole('option', { name: new RegExp(name) }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('opens the pair dialogue with the chosen person', async () => {
  const state = stubApi()
  renderFeature()

  const dialog = await openDialog()
  expect(within(dialog).getByRole('combobox', { name: 'Поиск людей' })).toHaveFocus()
  expect(within(dialog).queryByRole('option', { name: /Анна/ })).not.toBeInTheDocument()

  await choose(dialog, 'Боб')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Написать' }))

  expect(await screen.findByText('Диалог c-direct')).toBeInTheDocument()
  expect(state.posted).toEqual([JSON.stringify({ userIds: [bob.id] })])
})

it('creates a named group with several chosen people', async () => {
  const state = stubApi()
  renderFeature()

  const dialog = await openDialog()
  await choose(dialog, 'Боб')
  await choose(dialog, 'Кэрол')

  expect(within(dialog).getByRole('status')).toHaveTextContent('Выбрано 2 из 20.')
  const name = within(dialog).getByLabelText(/Название группы/)
  await userEvent.type(name, 'Планы')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Создать группу' }))

  expect(await screen.findByText('Диалог c-group')).toBeInTheDocument()
  expect(state.posted).toEqual([JSON.stringify({ userIds: [bob.id, carol.id] })])
  expect(state.renamed).toEqual(['Планы'])
})

it('creates an unnamed group when the optional title is left empty', async () => {
  const state = stubApi()
  renderFeature()

  const dialog = await openDialog()
  await choose(dialog, 'Боб')
  await choose(dialog, 'Кэрол')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Создать группу' }))

  expect(await screen.findByText('Диалог c-group')).toBeInTheDocument()
  expect(state.renamed).toEqual([])
})

it('filters people by name and says when nobody matches', async () => {
  stubApi()
  renderFeature()

  const dialog = await openDialog()
  const search = within(dialog).getByRole('combobox', { name: 'Поиск людей' })

  await userEvent.type(search, 'кэр')
  expect(within(dialog).getByRole('option', { name: /Кэрол/ })).toBeInTheDocument()
  expect(within(dialog).queryByRole('option', { name: /Боб/ })).not.toBeInTheDocument()

  await userEvent.clear(search)
  await userEvent.type(search, 'даша')
  expect(within(dialog).getByText('Никого не нашли.')).toBeInTheDocument()
  expect(within(dialog).queryByRole('option')).not.toBeInTheDocument()
})

it('picks and removes people with the keyboard', async () => {
  stubApi()
  renderFeature()

  const dialog = await openDialog()
  const search = within(dialog).getByRole('combobox', { name: 'Поиск людей' })
  await userEvent.type(search, 'Боб')
  await userEvent.keyboard('{Enter}')

  expect(within(dialog).getByRole('button', { name: 'Убрать Боб' })).toBeInTheDocument()
  expect(within(dialog).getByRole('status')).toHaveTextContent('Выбрано 1 из 20.')

  await userEvent.keyboard('{Backspace}')
  expect(within(dialog).queryByRole('button', { name: 'Убрать Боб' })).not.toBeInTheDocument()

  await userEvent.type(search, 'Боб')
  await userEvent.keyboard('{Enter}')
  const chip = within(dialog).getByRole('button', { name: 'Убрать Боб' })
  act(() => {
    chip.focus()
  })
  await userEvent.keyboard('{Enter}')
  expect(within(dialog).queryByRole('button', { name: 'Убрать Боб' })).not.toBeInTheDocument()
})

it('closes on Esc and gives focus to the search field when it opens', async () => {
  stubApi()
  renderFeature()

  const dialog = await openDialog()
  expect(within(dialog).getByRole('combobox', { name: 'Поиск людей' })).toHaveFocus()

  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog', { name: 'Новое сообщение' })).not.toBeInTheDocument()
})

it('says a refused person cannot be written to', async () => {
  stubApi({ startStatus: 404, startMessage: 'not found' })
  renderFeature()

  const dialog = await openDialog()
  await choose(dialog, 'Боб')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Написать' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Этому человеку нельзя написать.',
  )
  expect(within(dialog).getByRole('button', { name: 'Написать' })).toBeEnabled()
})

it('names the wait the server asks for after a 429', async () => {
  stubApi({ startStatus: 429, startMessage: 'too many', retryAfter: '7' })
  renderFeature()

  const dialog = await openDialog()
  await choose(dialog, 'Боб')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Написать' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Слишком часто, попробуйте через 7 с.',
  )
})

it('explains a group limit refusal in words', async () => {
  stubApi({
    startStatus: 409,
    startMessage: 'conversations: too many people for one group',
  })
  renderFeature()

  const dialog = await openDialog()
  await choose(dialog, 'Боб')
  await choose(dialog, 'Кэрол')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Создать группу' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'В группе уже слишком много участников. Выберите меньше людей.',
  )
})
