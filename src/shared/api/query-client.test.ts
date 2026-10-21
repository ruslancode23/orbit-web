import { ApiError } from './api-error'
import { getCurrentUserQueryKey } from './generated/@tanstack/react-query.gen'
import { createQueryClient, shouldRetry } from './query-client'

describe('shouldRetry', () => {
  const error = (status: number) => new ApiError({ status, code: 'x', message: 'x' })

  it('retries network failures and server errors', () => {
    expect(shouldRetry(0, error(0))).toBe(true)
    expect(shouldRetry(1, error(503))).toBe(true)
  })

  it('does not retry client errors', () => {
    expect(shouldRetry(0, error(400))).toBe(false)
    expect(shouldRetry(0, error(404))).toBe(false)
  })

  it('stops after two retries', () => {
    expect(shouldRetry(2, error(503))).toBe(false)
  })
})

describe('a session that ended', () => {
  const user = { id: 'u1', nickname: 'Anna', isGuest: false, createdAt: new Date() }

  /** Runs a query that fails the way the server would, and waits for the cache to react. */
  async function failWith(queryClient: ReturnType<typeof createQueryClient>, status: number) {
    await queryClient
      .query({
        queryKey: ['workspaces'],
        queryFn: () => Promise.reject(new ApiError({ status, code: 'x', message: 'x' })),
        retry: false,
      })
      .catch(() => undefined)
  }

  it('is forgotten on a 401, together with everything cached for it', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(getCurrentUserQueryKey(), user)
    queryClient.setQueryData(['rooms'], [{ id: 'r1' }])

    await failWith(queryClient, 401)

    expect(queryClient.getQueryData(getCurrentUserQueryKey())).toBeUndefined()
    expect(queryClient.getQueryData(['rooms'])).toBeUndefined()
  })

  it('is left alone by other failures', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(getCurrentUserQueryKey(), user)

    await failWith(queryClient, 500)

    expect(queryClient.getQueryData(getCurrentUserQueryKey())).toEqual(user)
  })

  it('survives a 401 from a mutation that only checks the current password', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(getCurrentUserQueryKey(), user)
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: () => Promise.reject(new ApiError({ status: 401, code: 'x', message: 'x' })),
      meta: { skipSessionExpiry: true },
      retry: false,
    })

    await mutation.execute(undefined).catch(() => undefined)
    await Promise.resolve()

    expect(queryClient.getQueryData(getCurrentUserQueryKey())).toEqual(user)
  })
})
