import { QueryClient } from '@tanstack/react-query'

import {
  ApiError,
  CLIENT_ERROR_CODES,
  createVoiceToken,
  createVoiceTokenMutation,
  getReadinessOptions,
  markChannelReadMutation,
} from './index'
import { serializeJsonBody } from './json-body'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('expected the request to fail')
}

const body = { room: 'dev-room', displayName: 'Anna' }

describe('generated client', () => {
  it('sends the request to the configured server and turns expiresAt into a Date', async () => {
    fetchMock.mockResolvedValue(
      json(201, {
        token: 'jwt',
        url: 'ws://lk.test',
        identity: 'guest-1',
        expiresAt: '2026-10-16T12:10:00Z',
      }),
    )

    const { data } = await createVoiceToken({ body })

    expect(data).toEqual({
      token: 'jwt',
      url: 'ws://lk.test',
      identity: 'guest-1',
      expiresAt: new Date('2026-10-16T12:10:00Z'),
    })
    const request = fetchMock.mock.calls[0]?.[0] as Request
    expect(request.url).toBe('http://localhost:8080/api/v1/voice/token')
    expect(request.method).toBe('POST')
    expect(request.headers.get('Content-Type')).toBe('application/json')
    expect(await request.text()).toBe(JSON.stringify(body))
  })

  it('rejects with ApiError carrying the server error', async () => {
    fetchMock.mockResolvedValue(
      json(400, { error: { code: 'invalid_request', message: 'room must be…' } }),
    )

    const error = await rejection(createVoiceToken({ body }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 400,
      code: 'invalid_request',
      message: 'room must be…',
      error: { code: 'invalid_request', message: 'room must be…' },
      isClientError: true,
    })
  })

  it('maps a non-JSON error page to http_error', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 }))

    expect(await rejection(createVoiceToken({ body }))).toMatchObject({
      status: 502,
      code: CLIENT_ERROR_CODES.http,
    })
  })

  it('maps a failed fetch to network_error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    expect(await rejection(createVoiceToken({ body }))).toMatchObject({
      status: 0,
      code: CLIENT_ERROR_CODES.network,
      isNetworkError: true,
    })
  })

  it('maps a truncated JSON success body to invalid_response', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"token":', { status: 201, headers: { 'Content-Type': 'application/json' } }),
    )

    expect(await rejection(createVoiceToken({ body }))).toMatchObject({
      status: 201,
      code: CLIENT_ERROR_CODES.invalidResponse,
    })
  })

  it('passes cancellation through untouched', async () => {
    const controller = new AbortController()
    controller.abort()
    const abortError = new DOMException('Aborted', 'AbortError')
    fetchMock.mockRejectedValue(abortError)

    expect(await rejection(createVoiceToken({ body, signal: controller.signal }))).toBe(abortError)
  })
})

describe('request bodies', () => {
  // The server reads int64 fields as JSON numbers and answers 400 to a string.
  it('sends an int64 field as a number', async () => {
    fetchMock.mockResolvedValue(
      json(200, { channelId: 'c-1', lastReadSeq: 73, unread: 0, mentions: 0 }),
    )

    const { mutationFn } = markChannelReadMutation()
    await mutationFn?.({ path: { channelId: 'c-1' }, body: { seq: 73n } }, {} as never)

    const request = fetchMock.mock.calls[0]?.[0] as Request
    expect(await request.text()).toBe('{"seq":73}')
  })

  it('refuses a number JSON cannot carry exactly', () => {
    expect(() => serializeJsonBody({ seq: 2n ** 60n })).toThrow(RangeError)
  })
})

describe('TanStack Query functions', () => {
  it('runs a mutation through createVoiceTokenMutation', async () => {
    fetchMock.mockResolvedValue(
      json(201, { token: 'jwt', url: 'ws://lk', identity: 'g', expiresAt: '2026-10-16T12:10:00Z' }),
    )
    const { mutationFn } = createVoiceTokenMutation()

    const data = await mutationFn?.({ body }, {} as never)

    expect(data?.expiresAt).toBeInstanceOf(Date)
  })

  it('fetches a query through getReadinessOptions', async () => {
    fetchMock.mockResolvedValue(json(200, { status: 'ok', database: 'up' }))
    const queryClient = new QueryClient()

    const data = await queryClient.query(getReadinessOptions())

    expect(data).toEqual({ status: 'ok', database: 'up' })
    expect(getReadinessOptions().queryKey[0]).toMatchObject({ _id: 'getReadiness' })
  })
})
