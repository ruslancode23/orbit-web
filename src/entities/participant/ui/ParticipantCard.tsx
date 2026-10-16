import { cn } from '@/shared/lib/cn'
import { HeadphonesOffIcon, MicOffIcon } from '@/shared/ui/icon'

import { describeVoiceState, initials, type Participant } from '../model/participant'

import type { ReactNode } from 'react'

interface ParticipantCardProps {
  participant: Participant
  /** Controls for this participant, e.g. a volume slider. */
  children?: ReactNode
  className?: string
}

/** Avatar with a speaking ring, the name and the voice state of one participant. */
export function ParticipantCard({ participant, children, className }: ParticipantCardProps) {
  const { name, isLocal, isSpeaking, isMicrophoneMuted, isDeafened } = participant
  const state = describeVoiceState(participant)

  return (
    <div
      data-speaking={isSpeaking}
      className={cn('flex flex-col gap-2 rounded-md bg-surface px-3 py-2', className)}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-hover text-sm font-semibold ring-2 ring-transparent ring-offset-2 ring-offset-surface',
            // No transition on the way in: the ring must appear as soon as the event does.
            isSpeaking ? 'ring-success' : 'transition-shadow duration-300',
          )}
        >
          {initials(name)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {name}
          {isLocal && <span className="text-fg-muted"> (вы)</span>}
          {state.length > 0 && <span className="sr-only">, {state.join(', ')}</span>}
        </span>
        {isDeafened ? (
          <HeadphonesOffIcon className="shrink-0 text-danger" />
        ) : (
          isMicrophoneMuted && <MicOffIcon className="shrink-0 text-danger" />
        )}
      </div>
      {children}
    </div>
  )
}
