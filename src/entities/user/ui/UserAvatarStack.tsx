import type { UserProfile } from '@/shared/api'
import { cn } from '@/shared/lib/cn'
import type { AvatarSize } from '@/shared/ui/avatar'

import { UserAvatar } from './UserAvatar'

export interface UserAvatarStackProps {
  /** The people to show; only the first two fit, as in a group chat row. */
  profiles: readonly Pick<
    UserProfile,
    'id' | 'nickname' | 'displayName' | 'avatarUrl' | 'accentColor'
  >[]
  size?: AvatarSize
  /** Hidden from assistive technology when the name beside it says it all. */
  decorative?: boolean
  className?: string
}

/**
 * A group's picture: the first two people overlapping, so a row reads as a
 * conversation between more than two without a separate group avatar.
 */
export const UserAvatarStack = ({
  profiles,
  size = 32,
  decorative = true,
  className,
}: UserAvatarStackProps) => {
  const shown = profiles.slice(0, 2)
  if (shown.length === 0) {
    return null
  }
  return (
    <span className={cn('flex shrink-0 -space-x-2', className)}>
      {shown.map((profile, index) => (
        <UserAvatar
          key={profile.id}
          profile={profile}
          size={size}
          decorative={decorative}
          className={cn('ring-2 ring-bg', index === 0 ? 'z-10' : '')}
        />
      ))}
    </span>
  )
}
