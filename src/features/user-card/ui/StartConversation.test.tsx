import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router'

import { renderWithProviders } from '@/shared/lib/test'

import { StartConversation } from './StartConversation'

const workspaceId = 'w-1'
const anna = {
  id: 'u-anna',
  nickname: 'Анна',
  displayName: 'Анна',
  accentColor: 'slate',
  bio: '',
  isGuest: false,
  createdAt: '2026-10-20T10:00:00Z',
}
const bob = {
  id: 'u-bob',
  nickname: 'Боб',
  displayName: 'Боб',
  accentColor: 'violet',
  bio: '',
  isGuest: false,
  createdAt: '2026-10-20T10:00:00Z',
}
const conversation = {
  id: 'c-direct',
  kind: 'direct',
  members: [anna, bob],
  createdAt: '2026-10-20T10:00:00Z',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const stubApi = () => {
  const posted: string[] = []
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
        return json([
          { user: anna, role: 'member', joinedAt: '2026-10-20T10:00:00Z' },
          { user: bob, role: 'member', joinedAt: '2026-10-20T10:00:00Z' },
        ])
      }
      if (url.pathname === '/api/v1/conversations' && request.method === 'POST') {
        posted.push(await request.clone().text())
        return json(conversation)
      }
      return json({})
    }),
  )
  return posted
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

afterEach(() => {
  vi.unstubAllGlobals()
})

it('opens the pair dialogue with the chosen person', async () => {
  const posted = stubApi()
  renderFeature()

  await userEvent.click(screen.getByRole('button', { name: 'Написать' }))
  expect(await screen.findByRole('heading', { name: 'Написать' })).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Написать Боб' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Написать Анна' })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Написать Боб' }))

  expect(await screen.findByText('Диалог c-direct')).toBeInTheDocument()
  expect(posted).toEqual([JSON.stringify({ userIds: [bob.id] })])
})

it('filters people by name', async () => {
  stubApi()
  renderFeature()

  await userEvent.click(screen.getByRole('button', { name: 'Написать' }))
  await screen.findByRole('button', { name: 'Написать Боб' })

  await userEvent.type(screen.getByRole('searchbox', { name: 'Поиск человека' }), 'даша')
  expect(screen.getByText('Никого не нашли.')).toBeInTheDocument()
})
