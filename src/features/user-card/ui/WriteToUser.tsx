import { useNavigate } from 'react-router'

import { useStartConversation } from '@/entities/conversation'
import { isApiError } from '@/shared/api'
import { MessageIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { useToast } from '@/shared/ui/toast'

interface WriteToUserProps {
  /** Whom to write to; the server returns the pair dialogue with this person. */
  userId: string
  /** The accessible name, specific enough for a row of people. */
  label: string
}

/**
 * The icon form of «Написать» for a row: it opens the existing pair dialogue
 * or creates it, and goes straight to it. The button waits for the answer, so
 * a second click cannot make a second conversation.
 */
export const WriteToUser = ({ userId, label }: WriteToUserProps) => {
  const navigate = useNavigate()
  const toast = useToast()
  const start = useStartConversation()

  const handleClick = () => {
    start.mutate(
      { body: { userIds: [userId] } },
      {
        onSuccess: (conversation) => {
          void navigate(`/me/${conversation.id}`)
        },
        onError: (error) => {
          toast(
            isApiError(error) && error.message !== ''
              ? error.message
              : 'Не удалось начать диалог. Попробуйте ещё раз.',
            'danger',
          )
        },
      },
    )
  }

  return (
    <IconButton
      label={label}
      disabled={start.isPending}
      aria-busy={start.isPending}
      onClick={handleClick}
    >
      <MessageIcon />
    </IconButton>
  )
}
