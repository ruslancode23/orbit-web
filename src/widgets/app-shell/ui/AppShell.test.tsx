import { screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

import { LiveProvider } from '@/entities/live'
import { renderWithProviders } from '@/shared/lib/test'

import { AppShell } from './AppShell'

const workspaceId = '11111111-1111-4111-8111-111111111111'
const channelId = '22222222-2222-4222-8222-222222222222'

const anna = { id: 'u1', nickname: 'Anna', isGuest: false, createdAt: '2026-10-18T10:00:00Z' }

function membership(role: 'owner' | 'admin' | 'member') {
  return {
    workspace: {
      id: workspaceId,
      name: 'Команда Orbit',
      ownerId: 'u1',
      createdAt: '2026-10-18T10:00:00Z',
    },
    role,
  }
}

const channels = [
  {
    id: channelId,
    workspaceId,
    name: 'общий',
    position: 0,
    isReadOnly: false,
    canWrite: true,
    createdAt: '2026-10-18T10:00:00Z',
  },
]

/** Answers whatever each endpoint of this test needs, by path. */
function stubApi(role: 'owner' | 'admin' | 'member') {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown) => {
      const url = input instanceof Request ? input.url : String(input)
      const body = url.includes('/auth/me')
        ? anna
        : url.includes('/channels')
          ? channels
          : url.includes('/workspaces')
            ? [membership(role)]
            : {}
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }),
  )
  // The shell opens a live connection; a socket that never connects is enough.
  vi.stubGlobal(
    'WebSocket',
    class {
      static readonly OPEN = 1
      readyState = 0
      // A socket that never connects: the shell must render without one.
      addEventListener() {
        return undefined
      }
      send() {
        return undefined
      }
      close() {
        return undefined
      }
    },
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderShell() {
  return renderWithProviders(
    <LiveProvider enabled>
      <MemoryRouter initialEntries={[`/s/${workspaceId}/${channelId}`]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/s/:workspaceId/:channelId" element={<p>содержимое канала</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LiveProvider>,
  )
}

it('shows the servers, the channels and the open channel', async () => {
  stubApi('member')
  renderShell()

  expect(await screen.findByRole('link', { name: '# общий' })).toBeInTheDocument()
  expect(screen.getByText('Команда Orbit')).toBeInTheDocument()
  expect(screen.getByText('содержимое канала')).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Серверы' })).toBeInTheDocument()
})

// A member sees no buttons they may not press. The server checks anyway; this
// is about not offering what will be refused.
it('offers managing to an admin and not to a member', async () => {
  stubApi('member')
  const { unmount } = renderShell()

  expect(await screen.findByRole('link', { name: '# общий' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '+ Канал' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Участники' })).not.toBeInTheDocument()
  unmount()

  vi.unstubAllGlobals()
  stubApi('admin')
  renderShell()

  expect(await screen.findByRole('button', { name: '+ Канал' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Участники' })).toBeInTheDocument()
})

it('names the signed-in account and offers to sign out', async () => {
  stubApi('member')
  renderShell()

  expect(await screen.findByText('Anna')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument()
})
