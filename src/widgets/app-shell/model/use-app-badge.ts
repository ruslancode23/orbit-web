import { useEffect } from 'react'

import { totalUnread, useConversationUnreadTotal, useWorkspaceUnread } from '@/entities/unread'
import { getPlatform } from '@/shared/platform'

/**
 * The unread number on the app's icon (DESK-5): what the current server and the dialogues have
 * unread. The desktop shell paints it; a browser used as an installed app paints it too, and a
 * plain tab ignores it.
 */
export function useAppBadge(workspaceId: string | undefined): void {
  const channels = useWorkspaceUnread(workspaceId)
  const conversations = useConversationUnreadTotal()
  const count = totalUnread(channels.data).unread + conversations.unread

  useEffect(() => {
    getPlatform().badge.set(count)
  }, [count])
}
