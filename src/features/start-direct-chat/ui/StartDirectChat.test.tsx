import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router'

import { renderWithProviders } from '@/shared/lib/test'

import { StartDirectChat } from './StartDirectChat'

const bob = { id: 'u-bob', nickname: 'Боб' }
const conversation = {
  id: 'c-direct',
  kind: 'direct',
  members: [
    { id: 'u-anna', nickname: 'Анна', isGuest: false, joinedAt: '2026-10-20T10:00:00Z' },
    { id: 'u-bob', nickname: 'Боб', isGuest: false, joinedAt: '2026-10-20T10:00:00Z' },
  ],
  createdAt: '2026-10-20T10:00:00Z',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const createDeferred = <T,>() => {
  let settle: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })
  return { promise, resolve: settle }
}

/** Answers the start endpoint with whatever the test needs and records the body. */
const stubApi = (answer: () => Promise<Response>) => {
  const posted: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      if (url.pathname === '/api/v1/conversations' && request.method === 'POST') {
        posted.push(await request.clone().text())
        return answer()
      }
      if (url.pathname === '/api/v1/conversations') {
        return json([])
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
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<StartDirectChat userId={bob.id} />} />
        <Route path="/me/:conversationId" element={<ConversationProbe />} />
      </Routes>
    </MemoryRouter>,
  )

afterEach(() => {
  vi.unstubAllGlobals()
})

it('starts the pair conversation and opens it', async () => {
  const posted = stubApi(() => Promise.resolve(json(conversation)))
  renderFeature()

  await userEvent.click(screen.getByRole('button', { name: 'Написать' }))

  expect(await screen.findByText('Диалог c-direct')).toBeInTheDocument()
  expect(posted).toEqual([JSON.stringify({ userIds: [bob.id] })])
})

it('is disabled while the conversation is being opened', async () => {
  const answer = createDeferred<Response>()
  stubApi(() => answer.promise)
  renderFeature()

  const button = screen.getByRole('button', { name: 'Написать' })
  await userEvent.click(button)

  expect(button).toBeDisabled()
  expect(button).toHaveAttribute('aria-busy', 'true')

  answer.resolve(json(conversation))
  expect(await screen.findByText('Диалог c-direct')).toBeInTheDocument()
})

it('shows the refusal of the server and stays on the page', async () => {
  stubApi(() =>
    Promise.resolve(
      json({ error: { code: 'forbidden', message: 'Этому человеку нельзя писать' } }, 403),
    ),
  )
  renderFeature()

  await userEvent.click(screen.getByRole('button', { name: 'Написать' }))

  expect(await screen.findByText('Этому человеку нельзя писать')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Написать' })).toBeEnabled()
  expect(screen.queryByText(/^Диалог /)).not.toBeInTheDocument()
})
