import { cn } from '@/shared/lib/cn'

import { userDisplayName, type NamedProfile } from '../model/profile'

export interface UserNameProps {
  profile: NamedProfile
  /**
   * Show `@nickname` beside the display name. By default it appears only when
   * the two differ, so the same name is not printed twice.
   */
  showNickname?: boolean
  className?: string
  nicknameClassName?: string
}

/** A person's display name, with their unique handle where that adds something. */
export const UserName = ({
  profile,
  showNickname,
  className,
  nicknameClassName,
}: UserNameProps) => {
  const displayName = (profile.displayName ?? '').trim()
  const showHandle = showNickname ?? (displayName !== '' && displayName !== profile.nickname)

  return (
    <span className={cn('inline-flex min-w-0 items-baseline gap-1', className)}>
      <span className="truncate">{userDisplayName(profile)}</span>
      {showHandle && (
        <span className={cn('truncate text-xs text-fg-muted', nicknameClassName)}>
          @{profile.nickname}
        </span>
      )}
    </span>
  )
}
