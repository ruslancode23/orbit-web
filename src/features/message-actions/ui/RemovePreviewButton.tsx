import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteMessagePreviewMutation, type Message } from '@/shared/api'
import { XIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { useToast } from '@/shared/ui/toast'

import { replaceMessageInHistory } from '../model/message-cache'

/**
 * The author's cross on the link preview. The preview is read from a third-party
 * page, so the author may always take it off their message; an edit later reads
 * the card of the new text again.
 */
export const RemovePreviewButton = ({ message }: { message: Message }) => {
  const queryClient = useQueryClient()
  const toast = useToast()
  const remove = useMutation({
    ...deleteMessagePreviewMutation(),
    onSuccess: () => {
      replaceMessageInHistory(queryClient, message.channelId, {
        ...message,
        preview: undefined,
      })
    },
    onError: () => {
      toast('Не получилось убрать превью.', 'danger')
    },
  })

  return (
    <IconButton
      label="Убрать превью"
      size="sm"
      variant="subtle"
      disabled={remove.isPending}
      onClick={() => {
        remove.mutate({ path: { messageId: message.id } })
      }}
    >
      <XIcon className="size-3.5" />
    </IconButton>
  )
}
