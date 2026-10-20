import { Link, useParams } from 'react-router'

import { conversationName, conversationPeer, useConversation } from '@/entities/conversation'
import { useSession } from '@/entities/session'
import { SecretChatMenuItem } from '@/features/start-secret-chat'
import { isApiError } from '@/shared/api'
import { initials } from '@/shared/lib/initials'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { MoreIcon, UsersIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { Skeleton } from '@/shared/ui/skeleton'
import { ChannelChat } from '@/widgets/channel-chat'

/** The middle of the personal-messages section when no dialogue is open. */
const DirectPlaceholder = () => {
  return (
    <section
      aria-labelledby="direct-placeholder-title"
      className="flex min-h-0 flex-1 items-center justify-center p-6"
    >
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-full bg-surface-hover"
        >
          <UsersIcon className="size-8 text-fg-muted" />
        </span>
        <h1 id="direct-placeholder-title" className="text-lg font-semibold">
          Выберите диалог
        </h1>
        <p className="text-sm text-fg-muted">
          Слева — личные сообщения и секретные чаты. Выберите человека, чтобы продолжить переписку.
        </p>
      </div>
    </section>
  )
}

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
        <Link to="/dm" className="text-sm text-accent hover:underline">
          К личным сообщениям
        </Link>
      </div>
    </section>
  )
}

/** One dialogue: a thin header with who it is with, then the usual chat. */
const ConversationView = ({ conversationId }: { conversationId: string }) => {
  const { user } = useSession()
  const { data: conversation, isPending, error } = useConversation(conversationId)

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

  return (
    <section aria-label="Диалог" className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 max-lg:pl-14">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-hover text-xs font-semibold"
        >
          {isGroup ? <UsersIcon className="size-4 text-fg-muted" /> : initials(name)}
        </span>
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-sm font-semibold">{name || 'Диалог'}</h1>
          {isGroup && <p className="truncate text-xs text-fg-muted">Групповой чат</p>}
        </div>
        {peer && (
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
        )}
      </header>

      <ChannelChat channelId={conversationId} channelName={name} canWrite canAttach />
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
      <Link to="/dm" className="text-sm text-accent hover:underline">
        К личным сообщениям
      </Link>
    </div>
  )
}

/**
 * The personal-messages page. Without an id it only says how to pick a
 * dialogue; with one it shows the conversation in the same chat the channels
 * use, so messages, files, replies and editing work the same way.
 */
const DirectPage = () => {
  const { conversationId } = useParams()

  if (conversationId === undefined || conversationId === '') {
    return <DirectPlaceholder />
  }
  return <ConversationView conversationId={conversationId} />
}

export default DirectPage
