import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { WorkspaceMember } from '@/entities/workspace'
import { renderWithProviders } from '@/shared/lib/test'

import { MemberContextMenu } from './MemberContextMenu'

import type * as ReactRouterModule from 'react-router'

const navigate = vi.fn()
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouterModule>()),
  useNavigate: () => navigate,
}))

const anna = { id: 'u-anna', nickname: 'anna', isGuest: false, createdAt: '2026-10-18T10:00:00Z' }
const boris: WorkspaceMember = {
  user: {
    id: 'u-boris',
    nickname: 'boris',
    displayName: 'Борис',
    accentColor: 'slate',
    bio: '',
    isGuest: false,
    createdAt: new Date('2026-10-18T10:00:00Z'),
  },
  role: 'member',
  joinedAt: new Date('2026-10-18T10:00:00Z'),
}
const conversationId = '55555555-5555-4555-8555-555555555555'

const json = (body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }),
  )

beforeEach(() => {
  navigate.mockClear()
  vi.stubGlobal(
    'fetch',
    vi.fn((request: Request) => {
      if (request.url.includes('/auth/me')) {
        return json(anna)
      }
      return json({
        id: conversationId,
        kind: 'direct',
        name: null,
        members: [],
        createdAt: '2026-10-18T10:00:00Z',
      })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('writes to a member and copies their handle', async () => {
  const writeText = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  renderWithProviders(
    <MemberContextMenu member={boris} name="Борис">
      <span>Борис</span>
    </MemberContextMenu>,
    { route: '/' },
  )

  fireEvent.contextMenu(screen.getByText('Борис'))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Копировать @boris' }))
  expect(writeText).toHaveBeenCalledWith('@boris')

  fireEvent.contextMenu(screen.getByText('Борис'))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Написать сообщение' }))
  await waitFor(() => {
    expect(navigate).toHaveBeenCalledWith(`/me/${conversationId}`)
  })
})

it('does not offer to write to oneself', async () => {
  renderWithProviders(
    <MemberContextMenu member={{ ...boris, user: { ...boris.user, id: anna.id } }} name="Я">
      <span>Я</span>
    </MemberContextMenu>,
    { route: '/' },
  )
  fireEvent.contextMenu(screen.getByText('Я'))
  expect(screen.getByRole('menuitem', { name: 'Копировать @boris' })).toBeInTheDocument()
  // Until the session arrives the menu cannot tell «me» apart; then the item goes.
  await waitFor(() => {
    expect(screen.queryByRole('menuitem', { name: 'Написать сообщение' })).toBeNull()
  })
})
