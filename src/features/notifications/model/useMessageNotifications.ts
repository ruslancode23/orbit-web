import { useEffect } from 'react'
import { useNavigate } from 'react-router'

import { useChannels } from '@/entities/channel'
import { useLive } from '@/entities/live'
import { useSession } from '@/entities/session'
import { useWorkspace } from '@/entities/workspace'
import { isPageVisible } from '@/shared/lib/page-visibility'
import { getPlatform } from '@/shared/platform'

import { incomingMessage, notificationBody, shouldNotify } from './message-notification'
import { useNotificationMode } from './mode'
import { useNotificationsMuted } from './mute'

interface Where {
  /** The server the live stream follows: only its messages arrive. */
  workspaceId: string | undefined
  /** The channel on screen; its messages are already being read. */
  channelId: string | undefined
}

/**
 * Turns new messages into system notifications, as the person chose in the
 * settings. Clicking one opens its channel.
 */
export function useMessageNotifications({ workspaceId, channelId }: Where): void {
  const { listen } = useLive()
  const { user } = useSession()
  const mode = useNotificationMode()
  const muted = useNotificationsMuted()
  const { data: channels } = useChannels(workspaceId)
  const { membership } = useWorkspace(workspaceId)
  const navigate = useNavigate()

  const myId = user?.id
  const workspaceName = membership?.workspace.name

  useEffect(() => {
    if (mode === 'off' || muted || workspaceId === undefined) {
      return undefined
    }
    return listen((event) => {
      const message = incomingMessage(event)
      if (!message) {
        return
      }
      const context = {
        mode,
        myId,
        openChannelId: channelId,
        pageVisible: isPageVisible(),
        muted,
      }
      if (!shouldNotify(message, context)) {
        return
      }

      const channel = channels?.find((item) => item.id === message.channelId)
      const place = [channel && `#${channel.name}`, workspaceName].filter(Boolean).join(' · ')
      getPlatform().notifications.show({
        title: place || 'Orbit',
        body: notificationBody(message),
        // One notification per channel: a busy channel replaces, not piles up.
        tag: message.channelId,
        onClick: () => {
          void navigate(`/s/${workspaceId}/${message.channelId}`)
        },
      })
    })
  }, [listen, mode, muted, myId, channelId, workspaceId, channels, workspaceName, navigate])
}
