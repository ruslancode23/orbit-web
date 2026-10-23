import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createFakePlatform, renderWithProviders } from '@/shared/lib/test'
import { setPlatform } from '@/shared/platform'

import { PushSettings } from './PushSettings'
import { forgetPushOnThisDevice } from '../model/push-subscription'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

interface Call {
  method: string
  path: string
  body: unknown
}

/** Answers the push endpoints and records what the client sent. */
const stubServer = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Request) => {
      const path = new URL(input.url).pathname
      const text = await input.text()
      calls.push({ method: input.method, path, body: text === '' ? null : JSON.parse(text) })
      if (path.endsWith('/push/config')) {
        return json(enabled ? { enabled: true, publicKey: 'BPublicKey' } : { enabled: false })
      }
      if (path.endsWith('/push/subscriptions') && input.method === 'POST') {
        return json({ id: 'sub-1' }, 201)
      }
      if (path.includes('/push/subscriptions/') && input.method === 'DELETE') {
        return new Response(null, { status: 204 })
      }
      return json({ error: { code: 'not_found', message: 'no' } }, 404)
    }),
  )
  return calls
}

const pushSwitch = () => screen.getByRole('switch', { name: 'Когда Orbit закрыт' })

let platform: ReturnType<typeof createFakePlatform>

beforeEach(() => {
  platform = createFakePlatform()
  setPlatform(platform)
})

afterEach(() => {
  setPlatform(null)
  localStorage.clear()
  vi.unstubAllGlobals()
})

it('subscribes this browser and remembers the subscription', async () => {
  const calls = stubServer()
  platform.notifications.permission.mockReturnValue('default')
  platform.notifications.requestPermission.mockResolvedValue('granted')
  renderWithProviders(<PushSettings />)

  await waitFor(() => {
    expect(pushSwitch()).toBeEnabled()
  })
  // Nothing is asked of the browser just by showing the setting.
  expect(platform.notifications.requestPermission).not.toHaveBeenCalled()

  await userEvent.click(pushSwitch())

  await waitFor(() => {
    expect(pushSwitch()).toBeChecked()
  })
  expect(platform.notifications.requestPermission).toHaveBeenCalledOnce()
  expect(platform.push.subscribe).toHaveBeenCalledWith('BPublicKey')
  expect(calls).toContainEqual({
    method: 'POST',
    path: '/api/v1/push/subscriptions',
    body: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/fake',
      keys: { p256dh: 'p256dh', auth: 'auth' },
    },
  })
  expect(localStorage.getItem('orbit.push.subscription-id')).toBe('sub-1')
})

it('turns off: the server forgets this browser, then the browser drops it', async () => {
  const calls = stubServer()
  localStorage.setItem('orbit.push.subscription-id', 'sub-1')
  platform.push.current.mockResolvedValue({
    endpoint: 'https://fcm.googleapis.com/x',
    keys: { p256dh: 'k', auth: 'a' },
  })
  renderWithProviders(<PushSettings />)

  await waitFor(() => {
    expect(pushSwitch()).toBeChecked()
  })
  await userEvent.click(pushSwitch())

  await waitFor(() => {
    expect(pushSwitch()).not.toBeChecked()
  })
  expect(calls).toContainEqual({
    method: 'DELETE',
    path: '/api/v1/push/subscriptions/sub-1',
    body: null,
  })
  expect(platform.push.unsubscribe).toHaveBeenCalledOnce()
  expect(localStorage.getItem('orbit.push.subscription-id')).toBeNull()
})

it('does not subscribe when the browser refuses notifications', async () => {
  stubServer()
  platform.notifications.permission.mockReturnValue('default')
  platform.notifications.requestPermission.mockResolvedValue('denied')
  renderWithProviders(<PushSettings />)

  await waitFor(() => {
    expect(pushSwitch()).toBeEnabled()
  })
  await userEvent.click(pushSwitch())

  expect(await screen.findByText(/Браузер запретил уведомления для Orbit/)).toBeVisible()
  expect(platform.push.subscribe).not.toHaveBeenCalled()
  expect(pushSwitch()).not.toBeChecked()
})

it('explains a browser without push and a server without it', async () => {
  stubServer()
  platform.push.isSupported.mockResolvedValue(false)
  const { unmount } = renderWithProviders(<PushSettings />)

  expect(await screen.findByText(/Этот браузер так не умеет/)).toBeVisible()
  expect(pushSwitch()).toBeDisabled()
  unmount()

  vi.unstubAllGlobals()
  stubServer({ enabled: false })
  platform.push.isSupported.mockResolvedValue(true)
  renderWithProviders(<PushSettings />)

  expect(await screen.findByText(/push-уведомления выключены/)).toBeVisible()
  expect(pushSwitch()).toBeDisabled()
})

it('forgets this device at sign-out, even with the server unreachable', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new TypeError('offline'))),
  )
  localStorage.setItem('orbit.push.subscription-id', 'sub-1')

  await forgetPushOnThisDevice()

  expect(platform.push.unsubscribe).toHaveBeenCalledOnce()
  expect(localStorage.getItem('orbit.push.subscription-id')).toBeNull()
})
