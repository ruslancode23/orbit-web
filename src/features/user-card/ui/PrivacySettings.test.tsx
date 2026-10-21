import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { BlockedUser, DmPolicy, FriendshipPolicy } from '@/shared/api'
import { renderWithProviders } from '@/shared/lib/test'

import { PrivacySettings } from './PrivacySettings'

const bob: BlockedUser = {
  id: 'u-bob',
  nickname: 'bob',
  createdAt: new Date('2026-10-20T10:00:00Z'),
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

interface State {
  dmPolicy: DmPolicy
  friendPolicy: FriendshipPolicy
  blocks: BlockedUser[]
  failDm: boolean
  failFriend: boolean
  requests: { method: string; path: string; body: unknown }[]
}

const stubApi = (): State => {
  const state: State = {
    dmPolicy: 'shared',
    friendPolicy: 'shared',
    blocks: [bob],
    failDm: false,
    failFriend: false,
    requests: [],
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      const body =
        request.method === 'PUT' || request.method === 'POST'
          ? ((await request.clone().json()) as unknown)
          : undefined
      state.requests.push({ method: request.method, path: url.pathname, body })
      if (url.pathname === '/api/v1/users/me/dm-policy') {
        if (request.method === 'PUT') {
          if (state.failDm) {
            return json({ error: { code: 'internal', message: 'boom' } }, 500)
          }
          const update = body as { dmPolicy: DmPolicy }
          state.dmPolicy = update.dmPolicy
          return json({ dmPolicy: state.dmPolicy })
        }
        return json({ dmPolicy: state.dmPolicy })
      }
      if (url.pathname === '/api/v1/users/me/friend-request-policy') {
        if (request.method === 'PUT') {
          if (state.failFriend) {
            return json({ error: { code: 'internal', message: 'boom' } }, 500)
          }
          const update = body as { friendRequestPolicy: FriendshipPolicy }
          state.friendPolicy = update.friendRequestPolicy
          return json({ friendRequestPolicy: state.friendPolicy })
        }
        return json({ friendRequestPolicy: state.friendPolicy })
      }
      if (url.pathname === '/api/v1/users/me/blocks') {
        return json(state.blocks)
      }
      if (url.pathname.startsWith('/api/v1/users/me/blocks/') && request.method === 'DELETE') {
        const id = url.pathname.split('/').at(-1)
        state.blocks = state.blocks.filter((user) => user.id !== id)
        return new Response(null, { status: 204 })
      }
      return json({})
    }),
  )
  return state
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const renderSettings = () => renderWithProviders(<PrivacySettings />, { route: '/' })

it('loads both policies and shows the chosen values', async () => {
  stubApi()
  renderSettings()

  const dm = await screen.findByRole('group', { name: 'Кто может мне писать' })
  const friends = screen.getByRole('group', { name: 'Кто может добавлять меня в друзья' })
  expect(await within(dm).findByRole('radio', { name: /^Люди с общих серверов/ })).toBeChecked()
  expect(
    await within(friends).findByRole('radio', { name: /^Люди с общих серверов/ }),
  ).toBeChecked()
})

it('saves who may write as soon as another option is chosen', async () => {
  const state = stubApi()
  renderSettings()

  const dm = await screen.findByRole('group', { name: 'Кто может мне писать' })
  await userEvent.click(await within(dm).findByRole('radio', { name: /^Никто/ }))

  expect(await screen.findByText('Кто может мне писать: сохранено')).toBeInTheDocument()
  await waitFor(() => {
    expect(state.requests).toContainEqual({
      method: 'PUT',
      path: '/api/v1/users/me/dm-policy',
      body: { dmPolicy: 'nobody' },
    })
  })
  expect(within(dm).getByRole('radio', { name: /^Никто/ })).toBeChecked()
  expect(state.dmPolicy).toBe('nobody')
})

it('saves who may add me as a friend as well', async () => {
  const state = stubApi()
  renderSettings()

  const friends = await screen.findByRole('group', { name: 'Кто может добавлять меня в друзья' })
  await userEvent.click(await within(friends).findByRole('radio', { name: /^Все/ }))

  expect(
    await screen.findByText('Кто может добавлять меня в друзья: сохранено'),
  ).toBeInTheDocument()
  await waitFor(() => {
    expect(state.requests).toContainEqual({
      method: 'PUT',
      path: '/api/v1/users/me/friend-request-policy',
      body: { friendRequestPolicy: 'all' },
    })
  })
  expect(within(friends).getByRole('radio', { name: /^Все/ })).toBeChecked()
})

it('keeps the previous choice and explains a refused save', async () => {
  const state = stubApi()
  state.failDm = true
  state.failFriend = true
  renderSettings()

  const dm = await screen.findByRole('group', { name: 'Кто может мне писать' })
  const friends = screen.getByRole('group', { name: 'Кто может добавлять меня в друзья' })

  await userEvent.click(await within(dm).findByRole('radio', { name: /^Никто/ }))
  expect(await within(dm).findByRole('alert')).toHaveTextContent(
    'Не удалось сохранить настройку. Попробуйте ещё раз.',
  )
  expect(await within(dm).findByRole('radio', { name: /^Люди с общих серверов/ })).toBeChecked()

  await userEvent.click(await within(friends).findByRole('radio', { name: /^Никто/ }))
  expect(await within(friends).findByRole('alert')).toHaveTextContent(
    'Не удалось сохранить настройку. Попробуйте ещё раз.',
  )
  expect(
    await within(friends).findByRole('radio', { name: /^Люди с общих серверов/ }),
  ).toBeChecked()
})

it('lists the blocked accounts and unblocks one of them', async () => {
  const state = stubApi()
  renderSettings()

  expect(await screen.findByText('@bob')).toBeInTheDocument()
  expect(screen.getByText(/^Заблокирован 20/)).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Разблокировать' }))

  await waitFor(() => {
    expect(screen.queryByText('@bob')).not.toBeInTheDocument()
  })
  expect(state.requests).toContainEqual({
    method: 'DELETE',
    path: '/api/v1/users/me/blocks/u-bob',
    body: undefined,
  })
  expect(await screen.findByText('Никого не заблокировали')).toBeInTheDocument()
})
