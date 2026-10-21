import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { useLive } from '@/entities/live'
import { useSession } from '@/entities/session'
import { isPageVisible } from '@/shared/lib/page-visibility'
import { getPlatform } from '@/shared/platform'

import { isConversationMuted } from './conversation-mute'
import { conversationIdFromPath, shouldNotifyDirect } from './direct-message-notification'
import { incomingMessage, notificationBody } from './message-notification'
import { useNotificationMode } from './mode'
import { useNotificationsMuted } from './mute'

/**
 * System notifications for personal messages. They arrive on the account
 * stream, without a server, and each one is news: unlike a channel, a dialogue
 * does not wait for a mention. A muted dialogue and «Не беспокоить» stay quiet.
 */
export function useDirectMessageNotifications(): void {
  const { listen } = useLive()
  const { user } = useSession()
  const mode = useNotificationMode()
  const muted = useNotificationsMuted()
  const location = useLocation()
  const navigate = useNavigate()
  const openConversationId = conversationIdFromPath(location.pathname)

  const myId = user?.id

  useEffect(() => {
    if (mode === 'off' || muted) {
      return undefined
    }
    return listen((event) => {
      if (event.workspaceId !== undefined) {
        return
      }
      const message = incomingMessage(event)
      if (!message) {
        return
      }
      if (
        !shouldNotifyDirect(message, {
          mode,
          myId,
          openConversationId,
          pageVisible: isPageVisible(),
          muted,
          conversationMuted: isConversationMuted(message.channelId),
        })
      ) {
        return
      }
      getPlatform().notifications.show({
        title: 'Личное сообщение',
        body: notificationBody(message),
        // One notification per dialogue: a fast conversation replaces, not piles up.
        tag: `direct-${message.channelId}`,
        onClick: () => {
          void navigate(`/me/${message.channelId}`)
        },
      })
    })
  }, [listen, mode, muted, myId, openConversationId, navigate])
}
