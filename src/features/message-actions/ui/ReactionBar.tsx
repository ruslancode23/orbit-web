import type { Message } from '@/shared/api'
import { pluralRu } from '@/shared/lib/plural'

import { describeActionError } from '../model/describe-error'
import { useReactionActions } from '../model/reactions'

interface ReactionBarProps {
  message: Message
  /** Reacting is writing; without it only one's own reactions can be taken back. */
  canWrite: boolean
}

/** The reactions of one message as chips; the picker lives in the actions panel above. */
export const ReactionBar = ({ message, canWrite }: ReactionBarProps) => {
  const { pending, error, react, unreact } = useReactionActions(message)

  if (message.deletedAt !== undefined) {
    return null
  }
  if (message.reactions.length === 0) {
    return null
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
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-xs text-fg transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50 aria-pressed:border-accent aria-pressed:bg-accent/20"
            onClick={() => {
              if (reaction.reacted) {
                unreact(reaction.emoji)
              } else {
                react(reaction.emoji)
              }
            }}
          >
            <span aria-hidden="true">{reaction.emoji}</span>
            <span aria-hidden="true">{reaction.count}</span>
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {describeActionError(error, 'Не получилось поставить реакцию.')}
        </p>
      )}
    </div>
  )
}

/** Counts in Russian: 1 реакция, 2 реакции, 5 реакций. */
const reactionWord = (count: number): string => pluralRu(count, ['реакция', 'реакции', 'реакций'])
