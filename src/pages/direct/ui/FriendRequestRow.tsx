import { type FriendRequest } from '@/entities/friend'
import { UserAvatar } from '@/entities/user'
import { CheckIcon, XIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'

interface FriendRequestRowProps {
  request: FriendRequest
  onAccept: (userId: string) => void
  onDecline: (userId: string) => void
  onCancel: (userId: string) => void
  pending: boolean
}

/** One pending request: a check and a cross for an incoming one, a cross for an outgoing one. */
const FriendRequestRow = ({
  request,
  onAccept,
  onDecline,
  onCancel,
  pending,
}: FriendRequestRowProps) => {
  const incoming = request.direction === 'incoming'

  return (
    <li className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover">
      <UserAvatar
        profile={{ nickname: request.nickname, displayName: request.nickname }}
        size={32}
        decorative
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-fg">@{request.nickname}</span>
        <span className="truncate text-xs text-fg-muted">
          {incoming ? 'Хочет добавить вас в друзья' : 'Заявка отправлена'}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {incoming ? (
          <>
            <IconButton
              label={`Принять заявку от ${request.nickname}`}
              className="text-success"
              disabled={pending}
              onClick={() => {
                onAccept(request.userId)
              }}
            >
              <CheckIcon />
            </IconButton>
            <IconButton
              label={`Отклонить заявку от ${request.nickname}`}
              variant="danger"
              disabled={pending}
              onClick={() => {
                onDecline(request.userId)
              }}
            >
              <XIcon />
            </IconButton>
          </>
        ) : (
          <IconButton
            label={`Отменить заявку для ${request.nickname}`}
            variant="danger"
            disabled={pending}
            onClick={() => {
              onCancel(request.userId)
            }}
          >
            <XIcon />
          </IconButton>
        )}
      </div>
    </li>
  )
}

export default FriendRequestRow
