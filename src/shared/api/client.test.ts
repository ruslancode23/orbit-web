import { ApiError, CLIENT_ERROR_CODES } from './api-error'
import { createApiClient } from './client'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('expected the request to fail')
}

describe('createApiClient', () => {
  const request = createApiClient('http://api.test/')

  it('sends JSON and parses the response', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { ok: true }))

    const result = await request<{ ok: boolean }>('/api/v1/things', {
      method: 'POST',
      body: { name: 'orbit' },
    })

    expect(result).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('http://api.test/api/v1/things')
    expect(init).toMatchObject({
      method: 'POST',
      body: '{"name":"orbit"}',
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('maps the server error format to ApiError', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: { code: 'invalid_request', message: 'room must be…' } }),
    )

    const error = await catchError(request('/x'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, code: 'invalid_request', message: 'room must be…' })
    expect((error as ApiError).isClientError).toBe(true)
  })

  it('maps a non-JSON error page to a generic HTTP error', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 }))

    const error = await catchError(request('/x'))

    expect(error).toMatchObject({ status: 502, code: CLIENT_ERROR_CODES.http })
  })

  it('maps a failed fetch to a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await catchError(request('/x'))

    expect(error).toMatchObject({ status: 0, code: CLIENT_ERROR_CODES.network })
    expect((error as ApiError).isNetworkError).toBe(true)
  })

  it('maps an invalid success body to invalid_response', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }))

    const error = await catchError(request('/x'))

    expect(error).toMatchObject({ status: 200, code: CLIENT_ERROR_CODES.invalidResponse })
  })

  it('rethrows cancellation as is', async () => {
    const controller = new AbortController()
    controller.abort()
    const abortError = new DOMException('Aborted', 'AbortError')
    fetchMock.mockRejectedValue(abortError)

    const error = await catchError(request('/x', { signal: controller.signal }))

    expect(error).toBe(abortError)
  })
})
