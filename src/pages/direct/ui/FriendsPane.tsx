import { useState, type ReactNode } from 'react'

import {
  asList,
  customStatusText,
  describeIncomingRequests,
  FriendsEmpty,
  isFriendOnline,
  useBlockedUsers,
  useFriendActions,
  useFriendProfiles,
  useFriendRequests,
  useFriends,
  type Friend,
  type FriendRequest,
} from '@/entities/friend'
import { userDisplayName } from '@/entities/user'
import { SearchIcon, ClockIcon, ShieldIcon, UserPlusIcon, UsersIcon } from '@/shared/ui/icon'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

import AddFriendDialog from './AddFriendDialog'
import BlockedUserRow from './BlockedUserRow'
import FriendRequestRow from './FriendRequestRow'
import FriendRow from './FriendRow'

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

const matches = (haystack: string, query: string): boolean => {
  return query === '' || haystack.toLocaleLowerCase('ru').includes(query)
}

const SearchEmpty = () => {
  return (
    <FriendsEmpty
      icon={<SearchIcon />}
      title="Никого не нашли"
      description="Попробуйте другое имя или ник."
    />
  )
}

/**
 * The friends section of the personal-messages page: the tabs over one
 * account's friendships, their pending requests and the people they blocked.
 *
 * The tab a person is on is not stored anywhere: `Tabs` keeps it, and every
 * tab draws its own list. Search narrows whichever list is open.
 */
const FriendsPane = () => {
  const friendsQuery = useFriends()
  const incomingQuery = useFriendRequests('incoming')
  const outgoingQuery = useFriendRequests('outgoing')
  const blocksQuery = useBlockedUsers()
  const actions = useFriendActions()
  const [search, setSearch] = useState('')

  const friends = asList(friendsQuery.data)
  const incoming = asList(incomingQuery.data)
  const outgoing = asList(outgoingQuery.data)
  const blocks = asList(blocksQuery.data)
  const profiles = useFriendProfiles(friends)
  const query = search.trim().toLocaleLowerCase('ru')

  const nameOf = (friend: Friend): string => {
    const profile = profiles.get(friend.id)
    return profile ? userDisplayName(profile) : friend.nickname
  }

  const matchesFriend = (friend: Friend): boolean => {
    const profile = profiles.get(friend.id)
    const haystack = [nameOf(friend), friend.nickname, customStatusText(profile)].join(' ')
    return matches(haystack, query)
  }

  const matchesRequest = (request: FriendRequest): boolean => {
    return matches(request.nickname, query)
  }

  const online = friends.filter(isFriendOnline).filter(matchesFriend)
  const all = friends.filter(matchesFriend)
  const incomingShown = incoming.filter(matchesRequest)
  const outgoingShown = outgoing.filter(matchesRequest)
  const blocksShown = blocks.filter((user) => matches(user.nickname, query))

  const friendList = (items: readonly Friend[], label: string, empty: ReactNode) => {
    if (friendsQuery.isPending) {
      return <ListSkeleton label="Загружаем друзей" />
    }
    if (friendsQuery.error) {
      return (
        <p role="alert" className="px-2 py-4 text-sm text-danger">
          Не удалось загрузить друзей.
        </p>
      )
    }
    if (items.length === 0) {
      return empty
    }
    return (
      <ul aria-label={label} className="flex flex-col gap-0.5">
        {items.map((friend) => (
          <FriendRow
            key={friend.id}
            friend={friend}
            profile={profiles.get(friend.id)}
            onRemove={actions.removeFriend}
            onBlock={actions.blockUser}
            pending={actions.isPending}
          />
        ))}
      </ul>
    )
  }

  const pending = () => {
    if (incomingQuery.isPending || outgoingQuery.isPending) {
      return <ListSkeleton label="Загружаем заявки" />
    }
    if (incomingQuery.error || outgoingQuery.error) {
      return (
        <p role="alert" className="px-2 py-4 text-sm text-danger">
          Не удалось загрузить заявки.
        </p>
      )
    }
    if (incoming.length === 0 && outgoing.length === 0) {
      return (
        <FriendsEmpty
          icon={<ClockIcon />}
          title="Нет ожидающих заявок"
          description="Входящие и отправленные заявки появятся здесь."
        />
      )
    }
    if (incomingShown.length === 0 && outgoingShown.length === 0) {
      return <SearchEmpty />
    }

    return (
      <div className="flex flex-col gap-4">
        <section aria-labelledby="incoming-requests-title" className="flex flex-col gap-1">
          <h2
            id="incoming-requests-title"
            className="px-2 text-xs font-semibold tracking-wide text-fg-muted uppercase"
          >
            Входящие
          </h2>
          {incomingShown.length === 0 ? (
            <p className="px-2 py-1 text-xs text-fg-muted">Нет входящих заявок</p>
          ) : (
            <ul aria-label="Входящие заявки" className="flex flex-col gap-0.5">
              {incomingShown.map((request) => (
                <FriendRequestRow
                  key={request.userId}
                  request={request}
                  onAccept={actions.acceptRequest}
                  onDecline={actions.declineRequest}
                  onCancel={actions.cancelRequest}
                  pending={actions.isPending}
                />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="outgoing-requests-title" className="flex flex-col gap-1">
          <h2
            id="outgoing-requests-title"
            className="px-2 text-xs font-semibold tracking-wide text-fg-muted uppercase"
          >
            Исходящие
          </h2>
          {outgoingShown.length === 0 ? (
            <p className="px-2 py-1 text-xs text-fg-muted">Нет исходящих заявок</p>
          ) : (
            <ul aria-label="Исходящие заявки" className="flex flex-col gap-0.5">
              {outgoingShown.map((request) => (
                <FriendRequestRow
                  key={request.userId}
                  request={request}
                  onAccept={actions.acceptRequest}
                  onDecline={actions.declineRequest}
                  onCancel={actions.cancelRequest}
                  pending={actions.isPending}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    )
  }

  const blocked = () => {
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
        <FriendsEmpty
          icon={<ShieldIcon />}
          title="Никого не заблокировали"
          description="Заблокированные пользователи не смогут писать вам."
        />
      )
    }
    if (blocksShown.length === 0) {
      return <SearchEmpty />
    }
    return (
      <ul aria-label="Заблокированные" className="flex flex-col gap-0.5">
        {blocksShown.map((user) => (
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

  return (
    <section aria-labelledby="friends-title" className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 max-lg:pl-14">
        <h1 id="friends-title" className="truncate text-sm font-semibold">
          Друзья
        </h1>
        <div className="ml-auto shrink-0">
          <AddFriendDialog />
        </div>
      </header>

      <Tabs defaultValue="online" className="flex min-h-0 flex-1 flex-col p-4">
        <TabsList aria-label="Разделы друзей" className="w-fit bg-surface">
          <TabsTrigger value="online" className="flex-none">
            В сети
          </TabsTrigger>
          <TabsTrigger value="all" className="flex-none">
            Все
          </TabsTrigger>
          <TabsTrigger
            value="pending"
            className="flex-none"
            aria-label={
              incoming.length > 0
                ? `Ожидание, ${describeIncomingRequests(incoming.length)}`
                : 'Ожидание'
            }
          >
            Ожидание
            {incoming.length > 0 && (
              <span
                aria-hidden="true"
                className="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-accent-fg"
              >
                {incoming.length > 9 ? '9+' : incoming.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="blocked" className="flex-none">
            Заблокированные
          </TabsTrigger>
        </TabsList>

        <div className="relative mt-3 shrink-0">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-fg-muted" />
          <Input
            type="search"
            aria-label="Поиск по друзьям"
            placeholder="Поиск по друзьям"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
            }}
            className="h-8 pl-7 text-sm"
          />
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <TabsContent value="online">
            {friendList(
              online,
              'Друзья в сети',
              query === '' ? (
                <FriendsEmpty
                  icon={<UsersIcon />}
                  title="Сейчас никого нет в сети"
                  description="Когда друзья зайдут, они появятся здесь."
                />
              ) : (
                <SearchEmpty />
              ),
            )}
          </TabsContent>

          <TabsContent value="all">
            {friendList(
              all,
              'Все друзья',
              query === '' ? (
                <FriendsEmpty
                  icon={<UserPlusIcon />}
                  title="Пока нет друзей"
                  description="Добавьте человека по нику — он получит заявку."
                />
              ) : (
                <SearchEmpty />
              ),
            )}
          </TabsContent>

          <TabsContent value="pending">{pending()}</TabsContent>

          <TabsContent value="blocked">{blocked()}</TabsContent>
        </div>
      </Tabs>
    </section>
  )
}

export default FriendsPane
