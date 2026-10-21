import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'

import {
  getCurrentUserQueryKey,
  listWorkspaceMembersQueryKey,
  type SelfProfile,
  type UserProfile,
  type WorkspaceMember,
} from '@/shared/api'

import { useUserProfile } from './queries'

import type { ReactNode } from 'react'

const workspaceId = '11111111-1111-4111-8111-111111111111'

const anna: UserProfile = {
  id: 'u-anna',
  nickname: 'anna',
  displayName: 'Анна',
  accentColor: 'violet',
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-10-18T10:00:00Z'),
}

const wrapperFor = (queryClient: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const stubFetch = (answer: () => Response) => {
  const calls: string[] = []
  const fetchMock = vi.fn((input: unknown) => {
    const request = input as Request
    calls.push(new URL(request.url).pathname)
    return Promise.resolve(answer())
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, calls }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// A member list already carries the profile, so a row that asks for it while
// the list is on screen must not send another request.
it('takes the profile from a loaded member list without a request', () => {
  const queryClient = new QueryClient()
  queryClient.setQueryData<WorkspaceMember[]>(
    listWorkspaceMembersQueryKey({ path: { workspaceId } }),
    [{ user: anna, role: 'member', joinedAt: new Date('2026-10-18T10:00:00Z') }],
  )
  const { fetchMock } = stubFetch(() => json({}))

  const { result } = renderHook(() => useUserProfile(anna.id), {
    wrapper: wrapperFor(queryClient),
  })

  expect(result.current.data).toEqual(anna)
  expect(fetchMock).not.toHaveBeenCalled()
})

it('takes the profile from the session cache when it is the reader', () => {
  const queryClient = new QueryClient()
  const me: SelfProfile = { ...anna, email: 'anna@example.com', profileOnboardedAt: null }
  queryClient.setQueryData(getCurrentUserQueryKey(), me)
  const { fetchMock } = stubFetch(() => json({}))

  const { result } = renderHook(() => useUserProfile(anna.id), {
    wrapper: wrapperFor(queryClient),
  })

  expect(result.current.data).toEqual(me)
  expect(fetchMock).not.toHaveBeenCalled()
})

it('asks the server when no cached answer carries the profile', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { calls } = stubFetch(() => json({ ...anna, createdAt: '2026-10-18T10:00:00Z' }))

  const { result } = renderHook(() => useUserProfile(anna.id), {
    wrapper: wrapperFor(queryClient),
  })

  await waitFor(() => {
    expect(result.current.data).toEqual(anna)
  })
  expect(calls).toEqual([`/api/v1/users/${anna.id}/profile`])
})

// A stranger and an unknown account answer the same 404: that is "no profile",
// not a failure the row should report.
it('treats a 404 as having no profile', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { fetchMock } = stubFetch(() =>
    json({ error: { code: 'not_found', message: 'no profile' } }, 404),
  )

  const { result } = renderHook(() => useUserProfile(anna.id), {
    wrapper: wrapperFor(queryClient),
  })

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true)
  })
  expect(result.current.data).toBeNull()
  expect(result.current.error).toBeNull()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
