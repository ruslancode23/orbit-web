import {
  asList,
  useBlockedUsers,
  useFriendActions,
  useFriendRequests,
  useFriends,
  useSendFriendRequest,
} from '@/entities/friend'
import { userDisplayName, useUserProfile } from '@/entities/user'
import { isApiError } from '@/shared/api'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import {
  BanIcon,
  ChevronDownIcon,
  MoreIcon,
  TrashIcon,
  UserPlusIcon,
  XIcon,
} from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { useToast } from '@/shared/ui/toast'

/** The only answer the server gives, whatever happened behind it. */
const NEUTRAL_ANSWER = 'Если такой пользователь есть, он получит заявку'

interface FriendActionSlotProps {
  userId: string
  /** Closes the card the action was taken from, after the server confirms it. */
  onDone?: () => void
}

const failureMessage = (error: unknown, fallback: string): string => {
  return isApiError(error) && error.message !== '' ? error.message : fallback
}

const BlockMenuItem = ({ pending, onBlock }: { pending: boolean; onBlock: () => void }) => {
  return (
    <DropdownMenuItem className="text-danger" disabled={pending} onSelect={onBlock}>
      <BanIcon className="size-4" />
      Заблокировать
    </DropdownMenuItem>
  )
}

/** The way to block a person who is not a friend (yet), where the card has no menu. */
const BlockMenu = ({
  name,
  pending,
  onBlock,
}: {
  name: string
  pending: boolean
  onBlock: () => void
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={`Ещё: ${name}`} size="sm" variant="ghost" disabled={pending}>
          <MoreIcon />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <BlockMenuItem pending={pending} onBlock={onBlock} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The friendship action of one card. The state is read from the friend cache,
 * never from a local flag: a `friend.*` event invalidates the lists and the
 * button redraws itself. Sending a request proves nothing — the server answers
 * 202 for a stored request and a stranger alike — so the only immediate
 * feedback is the neutral sentence, and «Заявка отправлена» appears once the
 * outgoing list really carries the row.
 *
 * Blocking is offered for every other account, not only for a friend: a
 * stranger or a former friend must be blockable too. It is a menu item rather
 * than a dialog, matching the friend row; a block is reversible from the
 * «Заблокированные» list. Once the block is in the cache the slot says
 * «Заблокирован» instead of offering actions again.
 */
export const FriendActionSlot = ({ userId, onDone }: FriendActionSlotProps) => {
  const toast = useToast()
  const actions = useFriendActions()
  const send = useSendFriendRequest()
  const friends = asList(useFriends().data)
  const incoming = asList(useFriendRequests('incoming').data)
  const outgoing = asList(useFriendRequests('outgoing').data)
  const blockedUsers = asList(useBlockedUsers().data)
  const { data: profile } = useUserProfile(userId)

  const isBlocked = blockedUsers.some((user) => user.id === userId)
  const isFriend = friends.some((friend) => friend.id === userId)
  const hasIncoming = incoming.some((request) => request.userId === userId)
  const hasOutgoing = outgoing.some((request) => request.userId === userId)
  const pending = actions.isPending || send.isPending
  const name = profile ? userDisplayName(profile) : 'человека'

  const block = () => {
    actions.blockUser(userId, onDone)
  }

  const sendRequest = () => {
    if (!profile) {
      return
    }
    send.mutate(
      { body: { nickname: profile.nickname } },
      {
        onSuccess: () => {
          toast(NEUTRAL_ANSWER)
        },
        onError: (error) => {
          toast(failureMessage(error, 'Не удалось отправить заявку. Попробуйте ещё раз.'), 'danger')
        },
      },
    )
  }

  if (isBlocked) {
    return (
      <span
        role="status"
        className="inline-flex items-center gap-1 px-1 text-xs font-medium text-fg-muted"
      >
        <BanIcon className="size-3.5" />
        Заблокирован
      </span>
    )
  }

  if (isFriend) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="secondary" disabled={pending}>
            Друзья
            <ChevronDownIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Друзья</DropdownMenuLabel>
          <DropdownMenuItem
            disabled={pending}
            onSelect={() => {
              actions.removeFriend(userId)
            }}
          >
            <TrashIcon className="size-4 text-fg-muted" />
            Удалить из друзей
          </DropdownMenuItem>
          <BlockMenuItem pending={pending} onBlock={block} />
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (hasIncoming) {
    return (
      <span className="inline-flex items-center gap-0.5">
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={pending}
          aria-busy={pending}
          onClick={() => {
            actions.acceptRequest(userId)
          }}
        >
          Принять заявку
        </Button>
        <BlockMenu name={name} pending={pending} onBlock={block} />
      </span>
    )
  }

  if (hasOutgoing) {
    return (
      <span className="inline-flex items-center gap-0.5">
        <span role="status" className="px-1 text-xs text-fg-muted">
          Заявка отправлена
        </span>
        <IconButton
          label="Отменить заявку"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            actions.cancelRequest(userId)
          }}
        >
          <XIcon className="size-3.5" />
        </IconButton>
        <BlockMenu name={name} pending={pending} onBlock={block} />
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending || !profile}
        aria-busy={send.isPending}
        onClick={sendRequest}
      >
        <UserPlusIcon className="size-4" />
        Добавить в друзья
      </Button>
      <BlockMenu name={name} pending={pending} onBlock={block} />
    </span>
  )
}
