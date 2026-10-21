import { useEffect } from 'react'
import { useNavigate } from 'react-router'

import { asList, useFriendRequests } from '@/entities/friend'
import { useLive } from '@/entities/live'
import { getPlatform } from '@/shared/platform'

import {
  acceptedFriend,
  friendAcceptedNotification,
  friendRequestNotification,
  incomingFriendRequest,
} from './friend-notification'
import { useFriendNotificationsEnabled } from './friend-notifications'
import { useNotificationsMuted } from './mute'

/**
 * System notifications for friendship: one when a request arrives, one when a
 * request this account sent is accepted. The badge belongs to the shell and is
 * fed by the same live events; this hook only speaks to the OS.
 *
 * `friend.added` reaches both sides, but only the requester did not just press
 * «Принять» themselves, so the outgoing list decides whether it is news.
 */
export function useFriendNotifications(): void {
  const { listen } = useLive()
  const navigate = useNavigate()
  const enabled = useFriendNotificationsEnabled()
  const muted = useNotificationsMuted()
  const outgoing = asList(useFriendRequests('outgoing').data)

  useEffect(() => {
    if (!enabled || muted) {
      return undefined
    }
    const requested = new Set(outgoing.map((request) => request.userId))

    return listen((event) => {
      const request = incomingFriendRequest(event)
      if (request) {
        getPlatform().notifications.show({
          ...friendRequestNotification(request),
          onClick: () => {
            void navigate('/me')
          },
        })
        return
      }

      const friend = acceptedFriend(event)
      if (friend && requested.has(friend.id)) {
        getPlatform().notifications.show({
          ...friendAcceptedNotification(friend),
          onClick: () => {
            void navigate('/me')
          },
        })
      }
    })
  }, [listen, enabled, muted, outgoing, navigate])
}
