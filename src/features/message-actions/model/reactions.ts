import { useMutation, useQueryClient } from '@tanstack/react-query'

import { addReactionMutation, removeReactionMutation, type Message } from '@/shared/api'

import { replaceMessageInHistory } from './message-cache'

/** The emoji the picker offers. Any emoji already on a message is shown beside them. */
export const REACTION_EMOJI = ['👍', '❤️', '😂', '🎉', '👀', '🙌'] as const

/**
 * Adding and taking back a reaction. The server answers with the whole updated
 * message, so the history cache takes exactly that instead of a refetch.
 */
export const useReactionActions = (message: Message) => {
  const queryClient = useQueryClient()

  const replace = (updated: Message) => {
    replaceMessageInHistory(queryClient, message.channelId, updated)
  }

  const add = useMutation({ ...addReactionMutation(), onSuccess: replace })
  const remove = useMutation({ ...removeReactionMutation(), onSuccess: replace })

  return {
    pending: add.isPending || remove.isPending,
    error: add.error ?? remove.error,
    react: (emoji: string) => {
      add.mutate({ path: { messageId: message.id, emoji } })
    },
    unreact: (emoji: string) => {
      remove.mutate({ path: { messageId: message.id, emoji } })
    },
  }
}
