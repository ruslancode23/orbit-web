import { requestVoiceToken } from './voice'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('requests a token and parses expiresAt', async () => {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        token: 'jwt',
        url: 'ws://lk.test',
        identity: 'guest-1',
        expiresAt: '2026-10-16T12:10:00Z',
      }),
      { status: 201 },
    ),
  )

  const token = await requestVoiceToken({ room: 'dev-room', displayName: 'Anna' })

  expect(token).toEqual({
    token: 'jwt',
    url: 'ws://lk.test',
    identity: 'guest-1',
    expiresAt: new Date('2026-10-16T12:10:00Z'),
  })
  const [url, init] = fetchMock.mock.calls[0] ?? []
  expect(url).toBe('http://localhost:8080/api/v1/voice/token')
  expect(init?.body).toBe('{"room":"dev-room","displayName":"Anna"}')
})
