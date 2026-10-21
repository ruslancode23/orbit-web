import type { BlockedUser } from '@/shared/api'
import { Avatar } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { ShieldIcon } from '@/shared/ui/icon'
import { Skeleton } from '@/shared/ui/skeleton'

import { FriendsEmpty } from './FriendsEmpty'
import { formatFriendDate } from '../model/friend'
import { asList, useBlockedUsers, useFriendActions } from '../model/queries'

import type { ReactNode } from 'react'

interface BlockedUsersListProps {
  /** Narrows the list by nickname; the settings show it whole. */
  search?: string
  /** Drawn when nothing is blocked at all. */
  empty?: ReactNode
  /** Drawn when the search matched nobody. */
  noMatches?: ReactNode
  /** The accessible name of the list. */
  label?: string
  className?: string
}

const ListSkeleton = ({ label }: { label: string }) => {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2 p-1">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-2">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

const BlockedUserRow = ({
  user,
  onUnblock,
  pending,
}: {
  user: BlockedUser
  onUnblock: (userId: string) => void
  pending: boolean
}) => {
  return (
    <li className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover">
      <Avatar name={user.nickname} size={32} decorative />

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

/**
 * The accounts this account blocked, with the way back. One component for the
 * friends section and the privacy tab of the settings, so the list, its empty
 * states and the unblock action are written once.
 */
export const BlockedUsersList = ({
  search = '',
  empty,
  noMatches,
  label = 'Заблокированные',
  className,
}: BlockedUsersListProps) => {
  const blocksQuery = useBlockedUsers()
  const actions = useFriendActions()
  const blocks = asList(blocksQuery.data)
  const query = search.trim().toLocaleLowerCase('ru')
  const shown = query === '' ? blocks : blocks.filter((user) => matches(user.nickname, query))

  if (blocksQuery.isPending) {
    return <ListSkeleton label="Загружаем заблокированных" />
  }
  if (blocksQuery.error) {
    return (
      <p role="alert" className="px-2 py-4 text-sm text-danger">
        Не удалось загрузить заблокированных.
      </p>
    )
  }
  if (blocks.length === 0) {
    return (
      <div className={className}>
        {empty ?? (
          <FriendsEmpty
            icon={<ShieldIcon />}
            title="Никого не заблокировали"
            description="Заблокированные пользователи не смогут писать вам."
          />
        )}
      </div>
    )
  }
  if (shown.length === 0) {
    return (
      <div className={className}>
        {noMatches ?? <p className="px-2 py-4 text-sm text-fg-muted">Никого не нашли.</p>}
      </div>
    )
  }

  return (
    <ul aria-label={label} className={className ?? 'flex flex-col gap-0.5'}>
      {shown.map((user) => (
        <BlockedUserRow
          key={user.id}
          user={user}
          onUnblock={actions.unblockUser}
          pending={actions.isPending}
        />
      ))}
    </ul>
  )
}

const matches = (nickname: string, query: string): boolean => {
  return nickname.toLocaleLowerCase('ru').includes(query)
}
