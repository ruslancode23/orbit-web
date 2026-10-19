import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { addReactionMutation, removeReactionMutation, type Message } from '@/shared/api'
import { Button } from '@/shared/ui/button'

import { describeActionError } from '../model/describe-error'
import { replaceMessageInHistory } from '../model/message-cache'

interface ReactionBarProps {
  message: Message
  /** Reacting is writing; without it only one's own reactions can be taken back. */
  canWrite: boolean
}

/** The emoji offered by the picker. Any emoji already on a message is shown too. */
const EMOJI = ['👍', '❤️', '😂', '🎉', '👀', '🙌'] as const

/**
 * Reactions of one message. The server answers with the updated message, so the
 * bar puts exactly that message into the cache instead of refetching the
 * history: the rest of the list keeps its place and does not re-render.
 */
export const ReactionBar = ({ message, canWrite }: ReactionBarProps) => {
  const queryClient = useQueryClient()
  const [picking, setPicking] = useState(false)
  const pickerId = `reactions-${message.id}`
  const addButtonRef = useRef<HTMLButtonElement | null>(null)

  const add = useMutation({
    ...addReactionMutation(),
    onSuccess: (updated) => {
      replaceMessageInHistory(queryClient, message.channelId, updated)
    },
  })
  const remove = useMutation({
    ...removeReactionMutation(),
    onSuccess: (updated) => {
      replaceMessageInHistory(queryClient, message.channelId, updated)
    },
  })
  const pending = add.isPending || remove.isPending
  const error = add.error ?? remove.error

  if (message.deletedAt !== undefined) return null
  if (message.reactions.length === 0 && !canWrite) return null

  const react = (emoji: string) => {
    add.mutate({ path: { messageId: message.id, emoji } })
  }

  const unreact = (emoji: string) => {
    remove.mutate({ path: { messageId: message.id, emoji } })
  }

  return (
    <div className="mt-1 flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        {message.reactions.map((reaction) => (
          <button
            key={reaction.emoji}
            type="button"
            aria-pressed={reaction.reacted}
            // The API reports the count and whether the reader is among them, not the
            // names: the hint says as much as the server knows.
            title={`${reaction.emoji}: ${String(reaction.count)} ${reactionWord(reaction.count)}${
              reaction.reacted ? ', среди них вы' : ''
            }`}
            aria-label={`${reaction.emoji}, ${String(reaction.count)} ${reactionWord(
              reaction.count,
            )}${reaction.reacted ? ', вы поставили' : ''}`}
            disabled={pending || (!reaction.reacted && !canWrite)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-xs text-fg hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50 aria-pressed:border-accent aria-pressed:bg-accent/20"
            onClick={() => {
              if (reaction.reacted) unreact(reaction.emoji)
              else react(reaction.emoji)
            }}
          >
            <span aria-hidden="true">{reaction.emoji}</span>
            <span aria-hidden="true">{reaction.count}</span>
          </button>
        ))}

        {canWrite && (
          <Button
            ref={addButtonRef}
            size="sm"
            variant="ghost"
            aria-label="Добавить реакцию"
            aria-expanded={picking}
            aria-controls={picking ? pickerId : undefined}
            onClick={() => {
              setPicking((current) => !current)
            }}
          >
            <span aria-hidden="true">🙂+</span>
          </Button>
        )}
      </div>

      {picking && (
        <div
          id={pickerId}
          role="group"
          aria-label="Выберите реакцию"
          className="flex flex-wrap gap-1"
        >
          {EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`Поставить реакцию ${emoji}`}
              disabled={pending}
              className="rounded-md border border-border bg-surface px-2 py-1 text-sm hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50"
              onClick={() => {
                setPicking(false)
                react(emoji)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') return
                setPicking(false)
                addButtonRef.current?.focus()
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-danger">
          {describeActionError(error, 'Не получилось поставить реакцию.')}
        </p>
      )}
    </div>
  )
}

/** Counts in Russian: 1 реакция, 2 реакции, 5 реакций. */
const reactionWord = (count: number): string => {
  const lastTwo = count % 100
  const last = count % 10
  if (last === 1 && lastTwo !== 11) return 'реакция'
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'реакции'
  return 'реакций'
}
