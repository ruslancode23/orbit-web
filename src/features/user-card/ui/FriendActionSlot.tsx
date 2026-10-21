import {
  asList,
  useFriendActions,
  useFriendRequests,
  useFriends,
  useSendFriendRequest,
} from '@/entities/friend'
import { useUserProfile } from '@/entities/user'
import { isApiError } from '@/shared/api'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { ChevronDownIcon, TrashIcon, UserPlusIcon, XIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { useToast } from '@/shared/ui/toast'

/** The only answer the server gives, whatever happened behind it. */
const NEUTRAL_ANSWER = 'Если такой пользователь есть, он получит заявку'

interface FriendActionSlotProps {
  userId: string
}

const failureMessage = (error: unknown, fallback: string): string => {
  return isApiError(error) && error.message !== '' ? error.message : fallback
}

/**
 * The friendship action of one card. The state is read from the friend cache,
 * never from a local flag: a `friend.*` event invalidates the lists and the
 * button redraws itself. Sending a request proves nothing — the server answers
 * 202 for a stored request and a stranger alike — so the only immediate
 * feedback is the neutral sentence, and «Заявка отправлена» appears once the
 * outgoing list really carries the row.
 */
export const FriendActionSlot = ({ userId }: FriendActionSlotProps) => {
  const toast = useToast()
  const actions = useFriendActions()
  const send = useSendFriendRequest()
  const friends = asList(useFriends().data)
  const incoming = asList(useFriendRequests('incoming').data)
  const outgoing = asList(useFriendRequests('outgoing').data)
  const { data: profile } = useUserProfile(userId)

  const isFriend = friends.some((friend) => friend.id === userId)
  const hasIncoming = incoming.some((request) => request.userId === userId)
  const hasOutgoing = outgoing.some((request) => request.userId === userId)
  const pending = actions.isPending || send.isPending

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
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (hasIncoming) {
    return (
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
      </span>
    )
  }

  return (
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
  )
}
