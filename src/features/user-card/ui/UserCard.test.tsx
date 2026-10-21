import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { UserProfile, WorkspaceMember } from '@/shared/api'
import { renderWithProviders } from '@/shared/lib/test'

import { UserCard } from './UserCard'

const me: UserProfile = {
  id: 'u-me',
  nickname: 'anna',
  displayName: 'Анна',
  accentColor: 'violet',
  bio: 'Пишу код и пью кофе.',
  isGuest: false,
  createdAt: new Date('2026-10-18T10:00:00Z'),
}
const bob: UserProfile = {
  id: 'u-bob',
  nickname: 'bob',
  displayName: 'Боб',
  accentColor: 'teal',
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-09-02T10:00:00Z'),
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

interface StubOptions {
  profile?: UserProfile
  missing?: boolean
  members?: Record<string, WorkspaceMember[]>
}

/** Answers the session, a profile and the member lists of the given servers. */
const stubApi = ({ profile = bob, missing = false, members = {} }: StubOptions = {}) => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      if (url.pathname.endsWith('/auth/me')) {
        return Promise.resolve(json(me))
      }
      const profilePath = /^\/api\/v1\/users\/([^/]+)\/profile$/u.exec(url.pathname)
      if (profilePath !== null) {
        return Promise.resolve(
          missing ? json({ error: { code: 'not_found', message: 'no' } }, 404) : json(profile),
        )
      }
      const membersPath = /^\/api\/v1\/workspaces\/([^/]+)\/members$/u.exec(url.pathname)
      if (membersPath !== null) {
        return Promise.resolve(json(members[membersPath[1] ?? ''] ?? []))
      }
      // The card's friendship action reads these lists; most cards in these
      // tests are about a person with no relationship yet.
      if (url.pathname === '/api/v1/friends' || url.pathname === '/api/v1/friends/requests') {
        return Promise.resolve(json([]))
      }
      return Promise.resolve(json({}))
    }),
  )
}

const renderCard = (
  props: Partial<Parameters<typeof UserCard>[0]> & Pick<Parameters<typeof UserCard>[0], 'userId'>,
) => {
  return renderWithProviders(
    <UserCard label={props.userId === me.id ? 'Анна' : 'Боб'} {...props}>
      <span>{props.userId === me.id ? 'Анна' : 'Боб'}</span>
    </UserCard>,
    { route: '/' },
  )
}

const openCard = async (name: string) => {
  await userEvent.click(screen.getByRole('button', { name }))
  return screen.getByRole('dialog', { name: `Карточка ${name}` })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('offers profile editing on your own card, and no write action', async () => {
  stubApi({ profile: me })
  renderCard({ userId: me.id })

  const card = await openCard('Анна')

  expect(within(card).getByRole('button', { name: 'Редактировать профиль' })).toBeInTheDocument()
  expect(within(card).queryByRole('button', { name: 'Написать' })).not.toBeInTheDocument()
  expect(within(card).getByText('Пишу код и пью кофе.')).toBeInTheDocument()
})

it('offers writing on someone else’s card, and no editing', async () => {
  stubApi()
  renderCard({ userId: bob.id })

  const card = await openCard('Боб')

  expect(within(card).getByRole('button', { name: 'Написать' })).toBeInTheDocument()
  expect(
    within(card).queryByRole('button', { name: 'Редактировать профиль' }),
  ).not.toBeInTheDocument()
})

it('opens on Enter and closes on Esc, returning focus to the trigger', async () => {
  stubApi()
  renderCard({ userId: bob.id })
  const trigger = screen.getByRole('button', { name: 'Боб' })
  trigger.focus()

  await userEvent.keyboard('{Enter}')
  expect(await screen.findByRole('dialog', { name: 'Карточка Боб' })).toBeInTheDocument()

  await userEvent.keyboard('{Escape}')
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  expect(trigger).toHaveFocus()
})

it('copies the handle and says so', async () => {
  const writeText = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
  stubApi()
  renderCard({ userId: bob.id })

  const card = await openCard('Боб')
  await userEvent.click(within(card).getByRole('button', { name: 'Скопировать @bob' }))

  expect(writeText).toHaveBeenCalledWith('@bob')
  expect(within(card).getByText('Скопировано')).toBeInTheDocument()
})

it('shows the role only where the person is a member of the open server', async () => {
  const members: WorkspaceMember[] = [
    { user: me, role: 'owner', joinedAt: new Date('2026-10-18T10:00:00Z') },
    { user: bob, role: 'admin', joinedAt: new Date('2026-09-02T10:00:00Z') },
  ]
  stubApi({ members: { 'w-here': members, 'w-other': [] } })

  const first = renderCard({ userId: bob.id, workspaceId: 'w-here' })
  const here = await openCard('Боб')
  expect(within(here).getByText('Роль на сервере')).toBeInTheDocument()
  expect(within(here).getByText('админ')).toBeInTheDocument()
  first.unmount()

  renderCard({ userId: bob.id, workspaceId: 'w-other' })
  const other = await openCard('Боб')
  expect(within(other).queryByText('Роль на сервере')).not.toBeInTheDocument()
})

it('does not break when the server has no profile for the account', async () => {
  stubApi({ missing: true })
  renderCard({ userId: 'u-gone' })

  await userEvent.click(screen.getByRole('button', { name: 'Боб' }))

  expect(await screen.findByText('Профиля нет.')).toBeInTheDocument()
  expect(
    within(screen.getByRole('dialog', { name: 'Карточка Боб' })).getByText('Боб'),
  ).toBeInTheDocument()
})

it('hides a custom status whose deadline has passed', async () => {
  stubApi({
    profile: {
      ...bob,
      customStatus: { text: 'в отпуске', expiresAt: new Date('2020-01-01T00:00:00Z') },
    },
  })
  renderCard({ userId: bob.id })

  const card = await openCard('Боб')
  expect(within(card).queryByText('в отпуске')).not.toBeInTheDocument()
})

it('shows a custom status that is still running', async () => {
  stubApi({
    profile: {
      ...bob,
      customStatus: { emoji: '🌴', text: 'в отпуске', expiresAt: new Date('2999-01-01T00:00:00Z') },
    },
  })
  renderCard({ userId: bob.id })

  const card = await openCard('Боб')
  expect(within(card).getByText('🌴 в отпуске')).toBeInTheDocument()
})

it('opens the profile editor from your own card', async () => {
  stubApi({ profile: me })
  renderCard({ userId: me.id })

  const card = await openCard('Анна')
  await userEvent.click(within(card).getByRole('button', { name: 'Редактировать профиль' }))

  const editor = await screen.findByRole('dialog', { name: 'Редактировать профиль' })
  expect(within(editor).getByRole('textbox', { name: 'Имя' })).toHaveValue('Анна')
  expect(within(editor).getByRole('textbox', { name: 'О себе' })).toHaveValue(
    'Пишу код и пью кофе.',
  )
})

it('opens the full profile with the same details', async () => {
  stubApi()
  renderCard({ userId: bob.id })

  const card = await openCard('Боб')
  await userEvent.click(within(card).getByRole('button', { name: 'Открыть профиль' }))

  const profile = await screen.findByRole('dialog', { name: 'Профиль Боб' })
  expect(within(profile).getByText('На Orbit с')).toBeInTheDocument()
  expect(within(profile).getByText('2 сентября 2026 г.')).toBeInTheDocument()
})
