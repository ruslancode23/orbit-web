import { createFakePlatform } from '@/shared/lib/test'
import { setPlatform } from '@/shared/platform'

import { clearSecretChats } from './clear-secret-chats'

afterEach(() => {
  vi.unstubAllGlobals()
  setPlatform(null)
})

const seed = async () => {
  const platform = createFakePlatform()
  setPlatform(platform)
  await platform.secretStore.set('secret', 'device', {
    deviceId: 'd-1',
    userId: 'u-1',
    name: 'browser',
    identityKey: 'a',
    signingKey: 'b',
  })
  await platform.secretStore.set('secret-chat', 'c-1', { chatId: 'c-1' })
  await platform.secretStore.set('secret-messages', 'c-1', [{ text: 'secret' }])
  return platform
}

it('revokes the device and wipes local secret chats', async () => {
  const platform = await seed()
  const fetchMock = vi.fn((_input: RequestInfo | URL) =>
    Promise.resolve(new Response(null, { status: 204 })),
  )
  vi.stubGlobal('fetch', fetchMock)

  await clearSecretChats()

  const request = fetchMock.mock.calls[0]?.[0] as Request | undefined
  expect(request?.method).toBe('DELETE')
  expect(request?.url).toContain('/api/v1/devices/d-1')
  expect(await platform.secretStore.get('secret', 'device', null)).toBeNull()
  expect(await platform.secretStore.get('secret-chat', 'c-1', null)).toBeNull()
  expect(await platform.secretStore.get('secret-messages', 'c-1', null)).toBeNull()
})

it('still wipes the device when the server cannot be reached', async () => {
  const platform = await seed()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline'))),
  )

  await clearSecretChats()

  expect(await platform.secretStore.get('secret', 'device', null)).toBeNull()
  expect(await platform.secretStore.keys('secret')).toEqual([])
})
