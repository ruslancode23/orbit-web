import { act, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

import { createFakePlatform } from '@/shared/lib/test'
import { setPlatform } from '@/shared/platform'

import { useSecretNotifications } from './useSecretNotifications'

const listeners: ((event: { type: string; channelId?: string; payload?: unknown }) => void)[] = []

vi.mock('@/entities/live', () => ({
  usePresenceChoice: () => 'auto',
  useLive: () => ({
    listen: (
      listener: (event: { type: string; channelId?: string; payload?: unknown }) => void,
    ) => {
      listeners.push(listener)
      return () => undefined
    },
  }),
}))

vi.mock('./mode', () => ({
  useNotificationMode: () => 'all',
}))

const renderAt = (path: string) =>
  renderHook(
    () => {
      useSecretNotifications()
    },
    {
      wrapper: ({ children }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>,
    },
  )

describe('secret chat notifications', () => {
  beforeEach(() => {
    listeners.length = 0
  })

  it('shows a notification without any content', () => {
    const platform = createFakePlatform()
    setPlatform(platform)
    renderAt('/me')

    act(() => {
      for (const listener of listeners) {
        listener({
          type: 'secret.envelope',
          channelId: 'chat-1',
          payload: { secretChatId: 'chat-1' },
        })
      }
    })

    expect(platform.notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Новое сообщение в секретном чате', tag: 'secret-chat-1' }),
    )
    const notification = vi.mocked(platform.notifications.show).mock.calls[0]?.[0]
    expect(notification?.body).toBeUndefined()
    setPlatform(null)
  })

  it('stays quiet while the chat is on screen', () => {
    const platform = createFakePlatform()
    setPlatform(platform)
    renderAt('/me/s/chat-1')

    act(() => {
      for (const listener of listeners) {
        listener({
          type: 'secret.envelope',
          channelId: 'chat-1',
          payload: { secretChatId: 'chat-1' },
        })
      }
    })

    expect(platform.notifications.show).not.toHaveBeenCalled()
    setPlatform(null)
  })
})
