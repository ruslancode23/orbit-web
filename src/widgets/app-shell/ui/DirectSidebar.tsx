import { NavLink } from 'react-router'

import { conversationName, conversationPeer, useConversations } from '@/entities/conversation'
import { secretChatName, useSecretChats, useSecretDevice } from '@/entities/secret-chat'
import type { SecretChat } from '@/entities/secret-chat'
import { useSession } from '@/entities/session'
import { UserAvatar, userDisplayName } from '@/entities/user'
import { SetupSecretChats } from '@/features/start-secret-chat'
import { cn } from '@/shared/lib/cn'
import { Avatar } from '@/shared/ui/avatar'
import { LockIcon, UsersIcon } from '@/shared/ui/icon'
import { Skeleton } from '@/shared/ui/skeleton'

interface DirectSidebarProps {
  className?: string
}

const rowClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
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
      <Skeleton className="h-7 w-full" />
      <Skeleton className="h-7 w-5/6" />
      <Skeleton className="h-7 w-4/5" />
    </div>
  )
}

/**
 * The left column in the personal-messages section. It replaces the channel
 * list: the dialogues of this account in the order the server keeps them, and
 * below them the secret chats of this browser, which exist only when a secret
 * device was created here.
 */
export const DirectSidebar = ({ className }: DirectSidebarProps) => {
  const { user } = useSession()
  const userId = user?.id ?? ''
  const conversations = useConversations()
  const device = useSecretDevice()
  const secretChats = useSecretChats(device.data?.deviceId)

  // A secret chat belongs under the dialogue with the same person: it is one of
  // their conversations, just encrypted and bound to this device.
  const secretsByPeer = new Map<string, SecretChat[]>()
  for (const chat of secretChats.data ?? []) {
    const list = secretsByPeer.get(chat.peer.userId) ?? []
    list.push(chat)
    secretsByPeer.set(chat.peer.userId, list)
  }
  const nested = new Set<string>()

  return (
    <aside
      aria-label="Личные сообщения"
      className={cn('flex min-h-0 w-64 shrink-0 flex-col border-r border-border bg-bg', className)}
    >
      <header className="flex h-12 shrink-0 items-center border-b border-border px-3">
        <h2 className="truncate text-sm font-semibold">Личные сообщения</h2>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2">
        <section aria-label="Диалоги" className="flex flex-col gap-1">
          {conversations.isPending ? (
            <ListSkeleton label="Загружаем диалоги" />
          ) : conversations.error ? (
            <p role="alert" className="px-2 text-xs text-danger">
              Не удалось загрузить диалоги.
            </p>
          ) : conversations.data.length === 0 ? (
            <p className="px-2 text-xs text-fg-muted">Пока нет личных сообщений</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {conversations.data.map((conversation) => {
                const name = conversationName(conversation, userId)
                const peer = conversationPeer(conversation, userId)
                const label = peer ? userDisplayName(peer) : name
                const secrets = peer ? (secretsByPeer.get(peer.id) ?? []) : []
                for (const secret of secrets) {
                  nested.add(secret.id)
                }
                return (
                  <li key={conversation.id} className="flex flex-col gap-0.5">
                    <NavLink to={`/dm/${conversation.id}`} className={rowClass}>
                      {peer ? (
                        <UserAvatar profile={peer} size={20} decorative />
                      ) : (
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-hover text-fg-muted">
                          <UsersIcon className="size-3" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                    </NavLink>
                    {secrets.length > 0 && (
                      <ul
                        aria-label={`Секретные чаты с ${name}`}
                        className="ml-4 flex flex-col gap-0.5"
                      >
                        {secrets.map((secret) => (
                          <li key={secret.id}>
                            <NavLink to={`/dm/s/${secret.id}`} className={secretRowClass}>
                              <LockIcon className="size-3.5 shrink-0" />
                              <span className="min-w-0 flex-1 truncate">Секретный чат</span>
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
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
                      <NavLink to={`/dm/s/${chat.id}`} className={secretRowClass}>
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
