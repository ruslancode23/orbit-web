import { useEffect, useRef, useState, type UIEvent } from 'react'
import { Link, NavLink, useLocation } from 'react-router'

import {
  conversationMembersExcept,
  conversationName,
  conversationPeer,
  describeConversationError,
  useConversationSummaries,
  useHideConversation,
  useUnhideConversation,
  type ConversationSummary,
} from '@/entities/conversation'
import { useFriends } from '@/entities/friend'
import { formatRelativeTime, systemEventText } from '@/entities/message'
import { secretChatName, useSecretChats, useSecretDevice } from '@/entities/secret-chat'
import type { SecretChat } from '@/entities/secret-chat'
import { useSession } from '@/entities/session'
import { describeUnread, UnreadBadge } from '@/entities/unread'
import { UserAvatar, UserAvatarStack, userDisplayName } from '@/entities/user'
import { SetupSecretChats } from '@/features/start-secret-chat'
import type { PresenceStatus } from '@/shared/api'
import { cn } from '@/shared/lib/cn'
import { Avatar } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { HideIcon, LockIcon, MoreIcon, SearchIcon, UsersIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'
import { useToast } from '@/shared/ui/toast'

interface DirectSidebarProps {
  className?: string
}

const rowClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-start gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm transition-colors',
    isActive
      ? 'bg-surface-hover font-medium text-fg'
      : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
  )

const secretRowClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
    isActive ? 'bg-surface-hover font-medium text-success' : 'text-success hover:bg-surface-hover',
  )

/** A column of its own: the list is the only thing here, no channels or people. */
const ListSkeleton = ({ label }: { label: string }) => {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2 p-1">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-2">
          <Skeleton className="size-5 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2.5 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** One line of the latest message, with the author first in a group. */
const previewOf = (summary: ConversationSummary): string => {
  const message = summary.lastMessage
  if (!message) {
    return 'Пока нет сообщений'
  }
  if (message.kind === 'system') {
    return systemEventText(message, summary.members) ?? 'Чат изменился'
  }
  if (message.deletedAt !== undefined) {
    return 'Сообщение удалено'
  }
  const content = message.content.replace(/\s+/g, ' ').trim()
  const text = content === '' ? 'Вложение' : content
  const preview = text.length > 120 ? `${text.slice(0, 119)}…` : text
  if (summary.kind === 'group' && message.author !== undefined) {
    return `${userDisplayName(message.author)}: ${preview}`
  }
  return preview
}

interface AvatarProps {
  summary: ConversationSummary
  userId: string
  presence: PresenceStatus | undefined
}

const ConversationAvatar = ({ summary, userId, presence }: AvatarProps) => {
  const peer = conversationPeer(summary, userId)
  if (peer) {
    return <UserAvatar profile={peer} size={20} status={presence} decorative />
  }
  const others = conversationMembersExcept(summary, userId)
  if (others.length === 0) {
    return (
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-hover text-fg-muted"
      >
        <UsersIcon className="size-3" />
      </span>
    )
  }
  return <UserAvatarStack profiles={others} size={20} />
}

/** A dialogue row: picture, name, last message, time and its unread badge. */
const ConversationRow = ({
  summary,
  userId,
  secrets,
  presences,
  onHide,
}: {
  summary: ConversationSummary
  userId: string
  secrets: readonly SecretChat[]
  presences: ReadonlyMap<string, PresenceStatus>
  onHide: (conversationId: string) => void
}) => {
  const peer = conversationPeer(summary, userId)
  const presence = peer ? presences.get(peer.id) : undefined
  const name = conversationName(summary, userId)
  const label = peer ? userDisplayName(peer) : name
  const unread = { unread: summary.unread, mentions: summary.mentions }
  const description = describeUnread(unread)
  const preview = previewOf(summary)
  const lastMessage = summary.lastMessage

  return (
    <li className="group relative flex flex-col gap-0.5">
      <NavLink
        to={`/me/${summary.id}`}
        className={rowClass}
        data-conversation-row="true"
        aria-label={description ? `${label}, ${description}` : label}
      >
        <ConversationAvatar summary={summary} userId={userId} presence={presence} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {lastMessage && (
              <time
                dateTime={lastMessage.createdAt.toISOString()}
                className="shrink-0 text-[0.6875rem] font-normal text-fg-muted"
              >
                {formatRelativeTime(lastMessage.createdAt)}
              </time>
            )}
          </span>
          <span className="flex items-center gap-1">
            <span className="min-w-0 flex-1 truncate text-xs font-normal text-fg-muted">
              {preview}
            </span>
            <UnreadBadge {...unread} />
          </span>
        </span>
      </NavLink>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            label="Действия с беседой"
            size="sm"
            className="absolute top-1.5 right-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          >
            <MoreIcon />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              onHide(summary.id)
            }}
          >
            <HideIcon className="size-4 text-fg-muted" />
            Скрыть
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {secrets.length > 0 && (
        <ul aria-label={`Секретные чаты с ${name}`} className="ml-4 flex flex-col gap-0.5">
          {secrets.map((secret) => (
            <li key={secret.id}>
              <NavLink to={`/me/s/${secret.id}`} className={secretRowClass}>
                <LockIcon className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">Секретный чат</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

const searchableName = (summary: ConversationSummary, userId: string): string => {
  const peer = conversationPeer(summary, userId)
  if (peer) {
    return `${userDisplayName(peer)} ${peer.nickname}`
  }
  const members = conversationMembersExcept(summary, userId)
    .map((member) => `${userDisplayName(member)} ${member.nickname}`)
    .join(' ')
  return `${conversationName(summary, userId)} ${members}`
}

/**
 * The left column in the personal-messages section. It replaces the channel
 * list: a search field, the dialogues of this account with the newest message
 * and the unread badge, and below them the secret chats of this browser, which
 * exist only when a secret device was created here.
 *
 * The list is paged by the server cursor: a screenful arrives in one request,
 * and the next page is asked for only when the reader reaches the end.
 */
export const DirectSidebar = ({ className }: DirectSidebarProps) => {
  const { user } = useSession()
  const userId = user?.id ?? ''
  const location = useLocation()
  const toast = useToast()
  // `/me` is the friends section itself, so the row is current there too.
  const friendsOpen = location.pathname === '/me' || location.pathname === '/me/friends'
  const { summaries, isPending, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useConversationSummaries()
  const hide = useHideConversation()
  const unhide = useUnhideConversation()
  const { data: friends } = useFriends()
  const presences = new Map((friends ?? []).map((friend) => [friend.id, friend.presence]))
  const device = useSecretDevice()
  const secretChats = useSecretChats(device.data?.deviceId)
  const [search, setSearch] = useState('')
  const listRef = useRef<HTMLUListElement | null>(null)
  const focusTimerRef = useRef<number | undefined>(undefined)

  const query = search.trim().toLocaleLowerCase('ru')
  const filtered =
    query === ''
      ? summaries
      : summaries.filter((summary) =>
          searchableName(summary, userId).toLocaleLowerCase('ru').includes(query),
        )

  const showMore = () => {
    // Where the new page begins, so focus can land on its first row instead of
    // falling to the page when the button goes away with the last page.
    const firstNew = filtered.length
    void fetchNextPage().then(() => {
      // The rows exist only after React has drawn the new page.
      focusTimerRef.current = globalThis.setTimeout(() => {
        const list = listRef.current
        const row = list?.querySelectorAll<HTMLElement>('[data-conversation-row]')[firstNew]
        if (row) {
          row.focus()
        } else {
          list?.focus()
        }
      }, 0)
    })
  }

  useEffect(() => {
    return () => {
      if (focusTimerRef.current !== undefined) {
        globalThis.clearTimeout(focusTimerRef.current)
      }
    }
  }, [])

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget
    // Near the bottom: bring in the next page of the list.
    if (
      element.scrollHeight - element.scrollTop - element.clientHeight < 64 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage()
    }
  }

  const hideConversation = (conversationId: string) => {
    hide.mutate(
      { path: { conversationId } },
      {
        onSuccess: () => {
          toast('Беседа скрыта', 'info', {
            label: 'Вернуть',
            onClick: () => {
              unhide.mutate(
                { path: { conversationId } },
                {
                  onError: (reason) => {
                    toast(
                      describeConversationError(reason, 'Не получилось вернуть беседу.'),
                      'danger',
                    )
                  },
                },
              )
            },
          })
        },
        onError: (reason) => {
          toast(describeConversationError(reason, 'Не получилось скрыть беседу.'), 'danger')
        },
      },
    )
  }

  // A secret chat belongs under the dialogue with the same person: it is one of
  // their conversations, just encrypted and bound to this device.
  const secretsByPeer = new Map<string, SecretChat[]>()
  for (const chat of secretChats.data ?? []) {
    const list = secretsByPeer.get(chat.peer.userId) ?? []
    list.push(chat)
    secretsByPeer.set(chat.peer.userId, list)
  }
  const nested = new Set<string>()
  for (const summary of summaries) {
    const peer = conversationPeer(summary, userId)
    if (!peer) {
      continue
    }
    for (const secret of secretsByPeer.get(peer.id) ?? []) {
      nested.add(secret.id)
    }
  }

  return (
    <aside
      aria-label="Личные сообщения"
      className={cn('flex min-h-0 w-64 shrink-0 flex-col border-r border-border bg-bg', className)}
    >
      <header className="flex h-12 shrink-0 items-center border-b border-border px-3">
        <h2 className="truncate text-sm font-semibold">Личные сообщения</h2>
      </header>

      <div className="shrink-0 px-2 pt-2">
        <Link
          to="/me/friends"
          aria-current={friendsOpen ? 'page' : undefined}
          className={cn(
            'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
            friendsOpen
              ? 'bg-surface-hover font-medium text-fg'
              : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
          )}
        >
          <UsersIcon className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Друзья</span>
        </Link>
      </div>

      <div className="shrink-0 px-2 pt-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-fg-muted" />
          <Input
            type="search"
            aria-label="Поиск по личным сообщениям"
            placeholder="Поиск"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
            }}
            className="h-8 pl-7 text-sm"
          />
        </div>
      </div>

      <div
        onScroll={handleScroll}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2"
      >
        <section aria-label="Диалоги" className="flex flex-col gap-1">
          {isPending ? (
            <ListSkeleton label="Загружаем диалоги" />
          ) : error ? (
            <p role="alert" className="px-2 text-xs text-danger">
              Не удалось загрузить диалоги.
            </p>
          ) : summaries.length === 0 ? (
            <p className="px-2 text-xs text-fg-muted">Пока нет личных сообщений</p>
          ) : (
            <>
              {filtered.length === 0 ? (
                <p className="px-2 text-xs text-fg-muted">Никого не нашли</p>
              ) : (
                <ul
                  ref={listRef}
                  tabIndex={-1}
                  aria-busy={isFetchingNextPage}
                  className="flex flex-col gap-0.5 focus:outline-none"
                >
                  {filtered.map((summary) => {
                    const peer = conversationPeer(summary, userId)
                    return (
                      <ConversationRow
                        key={summary.id}
                        summary={summary}
                        userId={userId}
                        secrets={peer ? (secretsByPeer.get(peer.id) ?? []) : []}
                        presences={presences}
                        onHide={hideConversation}
                      />
                    )
                  })}
                </ul>
              )}
              {hasNextPage && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isFetchingNextPage}
                  aria-busy={isFetchingNextPage}
                  onClick={showMore}
                >
                  Показать ещё
                </Button>
              )}
              {isFetchingNextPage && (
                <p role="status" className="px-2 text-xs text-fg-muted">
                  Загружаем ещё диалоги…
                </p>
              )}
            </>
          )}
        </section>

        {device.data === null && <SetupSecretChats />}

        {device.data && (secretChats.data ?? []).some((chat) => !nested.has(chat.id)) && (
          <section aria-labelledby="secret-chats-title" className="flex flex-col gap-1">
            <h3
              id="secret-chats-title"
              className="px-2 text-xs font-semibold tracking-wide text-fg-muted uppercase"
            >
              Секретные чаты
            </h3>
            {secretChats.isPending ? (
              <ListSkeleton label="Загружаем секретные чаты" />
            ) : secretChats.error ? (
              <p role="alert" className="px-2 text-xs text-danger">
                Не удалось загрузить секретные чаты.
              </p>
            ) : secretChats.data.length === 0 ? (
              <p className="px-2 text-xs text-fg-muted">Секретных чатов пока нет</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {secretChats.data
                  .filter((chat) => !nested.has(chat.id))
                  .map((chat) => (
                    <li key={chat.id}>
                      <NavLink to={`/me/s/${chat.id}`} className={secretRowClass}>
                        <Avatar
                          name={secretChatName(chat)}
                          size={20}
                          decorative
                          className="bg-success/15 text-success"
                        />
                        <LockIcon className="size-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{secretChatName(chat)}</span>
                      </NavLink>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </aside>
  )
}
