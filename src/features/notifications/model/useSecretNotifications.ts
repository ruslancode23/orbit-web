import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { useLive } from '@/entities/live'
import { isPageVisible } from '@/shared/lib/page-visibility'
import { getPlatform } from '@/shared/platform'

import { useNotificationMode } from './mode'
import { useNotificationsMuted } from './mute'

/** Only the identity of the chat: the envelope is ciphertext and stays that way. */
const secretChatIdOf = (payload: unknown): string | null => {
  if (typeof payload !== 'object' || payload === null) {
    return null
  }
  if (!('secretChatId' in payload) || typeof payload.secretChatId !== 'string') {
    return null
  }
  return payload.secretChatId
}

/**
 * A system notification for a secret chat never carries the text, the sender or
 * the file name: the server does not have them and the screen must not leak
 * them either. One per chat replaces the previous one.
 */
export function useSecretNotifications(): void {
  const { listen } = useLive()
  const mode = useNotificationMode()
  const muted = useNotificationsMuted()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (mode === 'off' || muted) {
      return undefined
    }
    return listen((event) => {
      if (event.type !== 'secret.envelope') {
        return
      }
      const chatId = secretChatIdOf(event.payload)
      if (!chatId) {
        return
      }
      // The chat is on screen and the tab is visible: the person is reading it.
      if (isPageVisible() && location.pathname === `/me/s/${chatId}`) {
        return
      }
      getPlatform().notifications.show({
        title: 'Новое сообщение в секретном чате',
        tag: `secret-${chatId}`,
        onClick: () => {
          void navigate(`/me/s/${chatId}`)
        },
      })
    })
  }, [listen, mode, muted, location.pathname, navigate])
}
