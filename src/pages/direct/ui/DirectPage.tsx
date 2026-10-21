import { Link, useParams } from 'react-router'

import {
  conversationMembersExcept,
  conversationName,
  conversationPeer,
  useConversation,
} from '@/entities/conversation'
import { useFriends } from '@/entities/friend'
import { useSession } from '@/entities/session'
import { UserAvatar, UserAvatarStack, UserName, userDisplayName } from '@/entities/user'
import { SecretChatMenuItem } from '@/features/start-secret-chat'
import { UserCard } from '@/features/user-card'
import { isApiError } from '@/shared/api'
import { pluralRu } from '@/shared/lib/plural'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { MoreIcon, PlusIcon, UsersIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { Skeleton } from '@/shared/ui/skeleton'
import { ChannelChat } from '@/widgets/channel-chat'

import FriendsPane from './FriendsPane'

const DirectLoading = () => {
  return (
    <div role="status" aria-label="Загружаем диалог" className="flex min-h-0 flex-1 flex-col p-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex flex-col gap-3 pt-4">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}

const DirectMissing = () => {
  return (
    <section
      aria-labelledby="direct-missing-title"
      className="flex min-h-0 flex-1 items-center justify-center p-6"
    >
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <h1 id="direct-missing-title" className="text-lg font-semibold">
          Диалог не найден
        </h1>
        <p className="text-sm text-fg-muted">
          Возможно, его удалили или у вас больше нет доступа к нему.
        </p>
        <Link to="/me" className="text-sm text-accent hover:underline">
          К личным сообщениям
        </Link>
      </div>
    </section>
  )
}

/** Who is in the group, in words: the count and the people beside the reader. */
const describeGroup = (names: readonly string[], total: number): string => {
  const count = `${String(total)} ${pluralRu(total, ['участник', 'участника', 'участников'])}`
  return names.length === 0 ? count : `${count}: ${names.join(', ')}`
}

/** One dialogue: a thin header with who it is with, then the usual chat. */
const ConversationView = ({ conversationId }: { conversationId: string }) => {
  const { user } = useSession()
  const { data: conversation, isPending, error } = useConversation(conversationId)
  // Presence of a peer is known for friends; a stranger stays without a dot.
  const { data: friends } = useFriends()

  if (isPending || user === undefined) {
    if (error) {
      return <DirectError error={error} />
    }
    return <DirectLoading />
  }
  if (error) {
    return <DirectError error={error} />
  }

  const isGroup = conversation.kind === 'group'
  const name = conversationName(conversation, user.id)
  const peer = conversationPeer(conversation, user.id)
  const others = conversationMembersExcept(conversation, user.id)
  const title = peer ? userDisplayName(peer) : name
  const presence = peer ? friends?.find((friend) => friend.id === peer.id)?.presence : undefined

  return (
    <section aria-label="Диалог" className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 max-lg:pl-14">
        {peer ? (
          <UserCard
            userId={peer.id}
            label={title}
            {...(presence === undefined ? {} : { status: presence })}
            triggerClassName="inline-flex shrink-0"
          >
            <UserAvatar profile={peer} size={32} status={presence} decorative />
          </UserCard>
        ) : others.length > 0 ? (
          <UserAvatarStack profiles={others} size={32} />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-hover"
          >
            <UsersIcon className="size-4 text-fg-muted" />
          </span>
        )}
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-sm font-semibold">
            {peer ? (
              <UserCard
                userId={peer.id}
                {...(presence === undefined ? {} : { status: presence })}
                triggerClassName="inline-flex max-w-full text-left"
              >
                <UserName profile={peer} />
              </UserCard>
            ) : (
              name || 'Диалог'
            )}
          </h1>
          {isGroup && (
            <p className="truncate text-xs text-fg-muted">
              {describeGroup(others.map(userDisplayName), conversation.members.length)}
            </p>
          )}
        </div>
        {isGroup ? (
          // Adding people needs a server method that does not exist yet. The
          // control sits where it will act, but stays off instead of pretending.
          <span className="ml-auto shrink-0">
            <IconButton label="Добавить людей" disabled>
              <PlusIcon />
            </IconButton>
          </span>
        ) : (
          peer && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label="Действия с диалогом" className="ml-auto">
                  <MoreIcon />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <SecretChatMenuItem userId={peer.id} nickname={peer.nickname} />
              </DropdownMenuContent>
            </DropdownMenu>
          )
        )}
      </header>

      <ChannelChat
        channelId={conversationId}
        channelName={title}
        mentionPeople={conversation.members}
        canWrite
        canAttach
      />
    </section>
  )
}

const DirectError = ({ error }: { error: unknown }) => {
  if (isApiError(error) && error.status === 404) {
    return <DirectMissing />
  }
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-2 p-6 text-center">
      <p role="alert" className="text-sm text-danger">
        Не удалось загрузить диалог.
      </p>
      <Link to="/me" className="text-sm text-accent hover:underline">
        К личным сообщениям
      </Link>
    </div>
  )
}

/**
 * The personal-messages page. Without an id it opens «Друзья» by default; with
 * one it shows the conversation in the same chat the channels use, so messages,
 * files, replies, reactions, editing and mentions work the same way.
 */
const DirectPage = () => {
  const { conversationId } = useParams()

  if (conversationId === undefined || conversationId === '') {
    return <FriendsPane />
  }
  return <ConversationView conversationId={conversationId} />
}

export default DirectPage
