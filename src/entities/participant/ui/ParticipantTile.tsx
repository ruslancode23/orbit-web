import { cn } from '@/shared/lib/cn'
import { HeadphonesOffIcon, MicOffIcon, ScreenIcon } from '@/shared/ui/icon'

import { describeVoiceState, initials, type Participant } from '../model/participant'

interface ParticipantTileProps {
  participant: Participant
  /** The room knows who shares a screen; the participant itself does not. */
  screenSharing?: boolean
}

/** One person in a voice channel, big enough to see the speaking ring. */
export const ParticipantTile = ({ participant, screenSharing = false }: ParticipantTileProps) => {
  const state = describeVoiceState(participant)
  if (screenSharing) {
    state.push('показывает экран')
  }

  return (
    <div
      role="group"
      aria-label={state.length > 0 ? `${participant.name}, ${state.join(', ')}` : participant.name}
      data-speaking={participant.isSpeaking}
      className={cn(
        'flex min-w-0 flex-col items-center gap-2 rounded-panel border bg-surface p-4 transition-colors',
        participant.isSpeaking ? 'border-success' : 'border-border',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-16 shrink-0 items-center justify-center rounded-full bg-surface-hover text-lg font-semibold ring-2 ring-transparent ring-offset-2 ring-offset-surface',
          participant.isSpeaking ? 'ring-success' : 'transition-shadow duration-300',
        )}
      >
        {initials(participant.name)}
      </span>
      <p className="flex w-full items-center justify-center gap-1 truncate text-sm font-medium">
        <span className="truncate">{participant.name}</span>
        {participant.isLocal && <span className="shrink-0 text-xs text-fg-muted">(вы)</span>}
      </p>
      <span aria-hidden="true" className="flex h-4 items-center gap-1 text-fg-muted">
        {screenSharing && <ScreenIcon className="size-3.5" />}
        {participant.isDeafened ? (
          <HeadphonesOffIcon className="size-3.5 text-danger" />
        ) : (
          participant.isMicrophoneMuted && <MicOffIcon className="size-3.5 text-danger" />
        )}
      </span>
    </div>
  )
}
