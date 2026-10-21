import type { UserProfile } from '@/shared/api'

import { MutualTabs } from './MutualTabs'

export { FriendActionSlot } from './FriendActionSlot'

interface ProfileTabsSlotProps {
  profile: UserProfile
  /** The server the card was opened from, when there is one. */
  workspaceId?: string
  /**
   * Your own card gets no shared lists: the endpoint answers 400 for the
   * reader's own account, and nobody needs a list of what they share with
   * themselves.
   */
  isMe: boolean
  /** Opens another person's profile in the same full-profile dialog. */
  onOpenPerson?: (userId: string) => void
  /** Closes the full profile before a server link leaves the page. */
  onLeave?: () => void
}

/**
 * The tab section of the full profile: «Общие серверы» and «Общие друзья»
 * (FR-5, SCRUM-102). The section owns its own query and stays away when the
 * endpoint has nothing to say, so a stranger, an unknown account or a blocked
 * pair leaves the profile exactly as it was.
 */
export const ProfileTabsSlot = ({ profile, isMe, onOpenPerson, onLeave }: ProfileTabsSlotProps) => {
  if (isMe) {
    return null
  }

  return (
    <MutualTabs
      profile={profile}
      {...(onOpenPerson === undefined ? {} : { onOpenPerson })}
      {...(onLeave === undefined ? {} : { onLeave })}
    />
  )
}
