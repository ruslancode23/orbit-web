import { formatFriendDate, type BlockedUser } from '@/entities/friend'
import { UserAvatar } from '@/entities/user'
import { Button } from '@/shared/ui/button'

interface BlockedUserRowProps {
  user: BlockedUser
  onUnblock: (userId: string) => void
  pending: boolean
}

/** One blocked account: who it is, when it happened, and the way back. */
const BlockedUserRow = ({ user, onUnblock, pending }: BlockedUserRowProps) => {
  return (
    <li className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover">
      <UserAvatar
        profile={{ nickname: user.nickname, displayName: user.nickname }}
        size={32}
        decorative
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-fg">@{user.nickname}</span>
        <span className="truncate text-xs text-fg-muted">
          Заблокирован {formatFriendDate(user.createdAt)}
        </span>
      </div>

      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          onUnblock(user.id)
        }}
      >
        Разблокировать
      </Button>
    </li>
  )
}

export default BlockedUserRow
