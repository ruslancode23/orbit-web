import type { UserProfile } from '@/shared/api'
import { Avatar, type AvatarSize, type AvatarStatus } from '@/shared/ui/avatar'

import { userDisplayName, userLabel } from '../model/profile'

export interface UserAvatarProps {
  profile: Pick<UserProfile, 'nickname' | 'displayName' | 'avatarUrl' | 'accentColor'>
  size?: AvatarSize
  /** Online presence, when the place already knows it. */
  status?: AvatarStatus
  /** Hidden from assistive technology when the text next to it names the person. */
  decorative?: boolean
  className?: string
}

/**
 * A person's picture from their public profile: the avatar link, or the
 * initials on the profile's accent colour when there is no picture or the
 * link no longer loads.
 */
export const UserAvatar = ({
  profile,
  size = 32,
  status,
  decorative = false,
  className,
}: UserAvatarProps) => {
  return (
    <Avatar
      name={userDisplayName(profile)}
      label={userLabel(profile)}
      src={profile.avatarUrl}
      accent={profile.accentColor}
      size={size}
      status={status}
      decorative={decorative}
      className={className}
    />
  )
}
