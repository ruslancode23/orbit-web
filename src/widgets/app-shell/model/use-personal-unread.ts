import { useEffect } from 'react'
import { useLocation } from 'react-router'

import { useLive } from '@/entities/live'
import { useSession } from '@/entities/session'
import { applyPersonalEvent, resetConversationUnread } from '@/entities/unread'
import { usePageVisible } from '@/shared/lib/page-visibility'

/** `/me/:conversationId` is an open dialogue; `/me`, `/me/friends` and `/me/s/...` are not. */
const OPEN_CONVERSATION = /^\/me\/(?!friends$)([^/]+)$/u

/**
 * Keeps the dialogue counters from the personal stream: a message that arrives
 * while its dialogue is not being read raises the badge, and `read.changed`
 * puts back the server's exact number — including what another tab just read.
 *
 * The stream runs for the whole app, not only inside the personal-messages
 * section, so the rail badge and the list agree whichever page is open.
 */
export const usePersonalUnread = () => {
  const { listen } = useLive()
  const { user } = useSession()
  const location = useLocation()
  const pageVisible = usePageVisible()
  const openChannelId = OPEN_CONVERSATION.exec(location.pathname)?.[1]
  const userId = user?.id

  useEffect(() => {
    // Counts belong to an account; another one starts from nothing.
    resetConversationUnread()
  }, [userId])

  useEffect(() => {
    return listen((event) => {
      applyPersonalEvent(event, { userId, openChannelId, viewing: pageVisible })
    })
  }, [listen, userId, openChannelId, pageVisible])
}
