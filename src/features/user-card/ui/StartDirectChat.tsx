import { useNavigate } from 'react-router'

import { useStartConversation } from '@/entities/conversation'
import { isApiError } from '@/shared/api'
import { Button, type ButtonProps } from '@/shared/ui/button'
import { useToast } from '@/shared/ui/toast'

interface StartDirectChatProps {
  /** Whom to write to; the server returns the pair dialogue with this person. */
  userId: string
  className?: string
  size?: ButtonProps['size']
  variant?: ButtonProps['variant']
  /** Closes the surface the button sits in before the dialogue opens. */
  onDone?: () => void
}

/**
 * The "Написать" action of a member card: it opens the pair dialogue the
 * server already has, or creates it, and goes straight to it. While the request
 * is on its way the button is disabled, so a second click cannot make a second
 * conversation.
 */
export const StartDirectChat = ({
  userId,
  className,
  size = 'sm',
  variant = 'secondary',
  onDone,
}: StartDirectChatProps) => {
  const navigate = useNavigate()
  const toast = useToast()
  const start = useStartConversation()

  const handleClick = () => {
    start.mutate(
      { body: { userIds: [userId] } },
      {
        onSuccess: (conversation) => {
          onDone?.()
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
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      disabled={start.isPending}
      aria-busy={start.isPending}
      onClick={handleClick}
    >
      Написать
    </Button>
  )
}
