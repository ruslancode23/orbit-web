import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { MutualOverview, UserProfile } from '@/shared/api'
import { renderWithProviders } from '@/shared/lib/test'

import { ProfileTabsSlot } from './ProfileSlots'

const bob: UserProfile = {
  id: 'u-bob',
  nickname: 'bob',
  displayName: 'Боб',
  accentColor: 'teal',
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-09-02T10:00:00Z'),
}

const vika: UserProfile = {
  id: 'u-vika',
  nickname: 'vika',
  displayName: 'Влад',
  accentColor: 'violet',
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-09-03T10:00:00Z'),
}

const overview: MutualOverview = {
  servers: [{ id: 'w-orbit', name: 'Orbit', iconUrl: null, role: 'admin' }],
  friends: [vika],
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** Answers the mutual request and records what was asked. */
const stubMutual = (answer: () => Response) => {
  const calls: string[] = []
  const fetchMock = vi.fn((input: unknown) => {
    const request = input as Request
    const url = new URL(request.url)
    calls.push(url.pathname)
    return Promise.resolve(answer())
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, fetchMock }
}

const renderSlot = (props: Partial<Parameters<typeof ProfileTabsSlot>[0]> = {}) =>
  renderWithProviders(<ProfileTabsSlot profile={bob} isMe={false} {...props} />, { route: '/' })

afterEach(() => {
  vi.unstubAllGlobals()
})

it('shows the shared servers with your role and a way into the server', async () => {
  stubMutual(() => json(overview))
  renderSlot()

  const servers = await screen.findByRole('tab', { name: 'Общие серверы' })
  expect(servers).toBeInTheDocument()

  const link = screen.getByRole('link', { name: 'Orbit, ваша роль: админ' })
  expect(link).toHaveAttribute('href', '/s/w-orbit')
  expect(screen.getByText('Ваша роль: админ')).toBeInTheDocument()
  // The picture is named too, so a server without a loaded icon still reads.
  expect(screen.getByRole('img', { name: 'Orbit' })).toBeInTheDocument()
})

it('shows the shared friends and opens their full profile', async () => {
  stubMutual(() => json(overview))
  const onOpenPerson = vi.fn()
  renderSlot({ onOpenPerson })

  await screen.findByRole('tab', { name: 'Общие серверы' })
  await userEvent.click(screen.getByRole('tab', { name: 'Общие друзья' }))

  const person = screen.getByRole('button', { name: /Влад/ })
  expect(person).toHaveTextContent('@vika')
  await userEvent.click(person)

  expect(onOpenPerson).toHaveBeenCalledWith(vika.id)
})

it('shows an empty state in the tab whose list is empty', async () => {
  stubMutual(() => json({ ...overview, friends: [] }))
  renderSlot()

  await screen.findByRole('tab', { name: 'Общие серверы' })
  await userEvent.click(screen.getByRole('tab', { name: 'Общие друзья' }))

  expect(screen.getByRole('status')).toHaveTextContent('Общих друзей нет')
})

it('draws no tabs when there is nothing shared at all', async () => {
  const { calls } = stubMutual(() => json({ servers: [], friends: [] }))
  renderSlot()

  await waitFor(() => {
    expect(calls).toEqual([`/api/v1/users/${bob.id}/mutual`])
  })
  expect(screen.queryByRole('tab', { name: 'Общие серверы' })).not.toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'Общие друзья' })).not.toBeInTheDocument()
})

it('asks nothing and draws nothing for your own card', () => {
  const { fetchMock } = stubMutual(() => json(overview))
  renderSlot({ isMe: true })

  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
})

it('hides the tabs when the server answers 404 or 400', async () => {
  for (const status of [404, 400]) {
    const { fetchMock } = stubMutual(() =>
      json({ error: { code: 'not_found', message: 'no' } }, status),
    )
    const { unmount } = renderSlot()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    unmount()
    vi.unstubAllGlobals()
  }
})
