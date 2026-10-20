import { customStatusText, type Friend } from '@/entities/friend'
import { UserAvatar, userDisplayName } from '@/entities/user'
import { WriteToUser } from '@/features/start-direct-chat'
import type { UserProfile } from '@/shared/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { BanIcon, MoreIcon, TrashIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'

interface FriendRowProps {
  friend: Friend
  /** Absent while the profile request is on its way; the handle and presence still draw. */
  profile?: UserProfile
  onRemove: (userId: string) => void
  onBlock: (userId: string) => void
  pending: boolean
}

/** One friend: picture and status, name and handle, then what can be done with them. */
const FriendRow = ({ friend, profile, onRemove, onBlock, pending }: FriendRowProps) => {
  const name = profile ? userDisplayName(profile) : friend.nickname
  const status = customStatusText(profile)

  return (
    <li className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover">
      <UserAvatar
        profile={{
          nickname: friend.nickname,
          displayName: profile?.displayName ?? friend.nickname,
          avatarUrl: profile?.avatarUrl,
          accentColor: profile?.accentColor,
        }}
        status={friend.presence}
        size={32}
        decorative
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-sm font-medium text-fg">{name}</span>
          <span className="truncate text-xs text-fg-muted">@{friend.nickname}</span>
        </div>
        {status !== '' && <p className="truncate text-xs text-fg-muted">{status}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <WriteToUser userId={friend.id} label={`Написать ${name}`} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label={`Ещё: ${name}`} disabled={pending}>
              <MoreIcon />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => {
                onRemove(friend.id)
              }}
            >
              <TrashIcon className="size-4 text-fg-muted" />
              Удалить из друзей
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={pending}
              className="text-danger"
              onSelect={() => {
                onBlock(friend.id)
              }}
            >
              <BanIcon className="size-4" />
              Заблокировать
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}

export default FriendRow
