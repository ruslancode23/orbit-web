import { useId, type ReactNode } from 'react'

import { UserAvatar, userDisplayName } from '@/entities/user'
import { ROLE_NAME, type WorkspaceMember } from '@/entities/workspace'
import type { UserProfile } from '@/shared/api'
import type { AvatarStatus } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'

import { CopyNicknameButton } from './CopyNicknameButton'
import { ModerationActions } from './ModerationActions'
import { FriendActionSlot, ProfileTabsSlot } from './ProfileSlots'
import { StartDirectChat } from './StartDirectChat'
import { accentBannerClass, formatRegistrationDate, visibleCustomStatus } from '../model/profile'

interface UserCardDetailsProps {
  profile: UserProfile
  /** The person's membership on the server the card was opened from, if any. */
  member?: WorkspaceMember
  /** Presence, when the place the card was opened from already knows it. */
  status?: AvatarStatus
  isMe: boolean
  workspaceId?: string
  /** Card-only content, such as the voice state and volume in the member list. */
  extra?: ReactNode
  /**
   * The dialog has no «Открыть профиль» button: it is already the full profile.
   * `preview` is the same card without actions, for a live preview in settings.
   */
  mode: 'popover' | 'dialog' | 'preview'
  onEdit: () => void
  onOpenProfile?: () => void
  onDone?: () => void
}

/**
 * The same profile everywhere: the accent banner, the big avatar, the name and
 * handle, the custom status, the bio, and what this account is on this server.
 * The mini card and the full dialog differ only in the extra tab slot and in
 * whether the «Открыть профиль» action makes sense.
 */
export const UserCardDetails = ({
  profile,
  member,
  status,
  isMe,
  workspaceId,
  extra,
  mode,
  onEdit,
  onOpenProfile,
  onDone,
}: UserCardDetailsProps) => {
  const bioId = useId()
  const name = userDisplayName(profile)
  const customStatus = visibleCustomStatus(profile)
  const presence = status ?? member?.presence

  return (
    <div className="flex flex-col bg-surface-raised">
      <div
        aria-hidden="true"
        className={`h-16 w-full rounded-t-panel ${accentBannerClass(profile.accentColor)}`}
      />
      <div className="flex flex-col gap-3 px-4 pb-4">
        <div className="-mt-9 flex items-end justify-between gap-2">
          <UserAvatar
            profile={profile}
            size={80}
            status={presence}
            className="ring-4 ring-surface-raised"
          />
          {profile.isGuest && (
            <span className="mb-1 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] tracking-wide text-fg-muted uppercase">
              гость
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-base leading-tight font-semibold">{name}</p>
          <div className="flex items-center gap-1 text-sm text-fg-muted">
            <span className="truncate">@{profile.nickname}</span>
            <CopyNicknameButton nickname={profile.nickname} />
          </div>
          {customStatus !== '' && <p className="text-sm text-fg">{customStatus}</p>}
        </div>

        <section aria-labelledby={bioId} className="flex flex-col gap-1">
          <h3 id={bioId} className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
            О себе
          </h3>
          <p className="text-sm whitespace-pre-wrap text-fg">
            {profile.bio.trim() !== '' ? profile.bio : 'Пока ничего не рассказано.'}
          </p>
        </section>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {member && (
            <>
              <dt className="text-fg-muted">Роль на сервере</dt>
              <dd>{ROLE_NAME[member.role]}</dd>
            </>
          )}
          <dt className="text-fg-muted">На Orbit с</dt>
          <dd>
            <time dateTime={profile.createdAt.toISOString()}>
              {formatRegistrationDate(profile.createdAt)}
            </time>
          </dd>
        </dl>

        {extra}

        {mode === 'dialog' && <ProfileTabsSlot profile={profile} workspaceId={workspaceId} />}

        {mode !== 'preview' && (
          <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
            {!isMe && (
              <StartDirectChat
                userId={profile.id}
                size="sm"
                variant="secondary"
                {...(onDone ? { onDone } : {})}
              />
            )}
            {isMe && (
              <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
                Редактировать профиль
              </Button>
            )}
            {onOpenProfile !== undefined && (
              <Button type="button" size="sm" variant="ghost" onClick={onOpenProfile}>
                Открыть профиль
              </Button>
            )}
            {!isMe && <FriendActionSlot userId={profile.id} />}
          </div>
        )}

        {mode !== 'preview' && member !== undefined && workspaceId !== undefined && (
          <ModerationActions workspaceId={workspaceId} member={member} />
        )}
      </div>
    </div>
  )
}
