import { cn } from '@/shared/lib/cn'
import { Avatar } from '@/shared/ui/avatar'
import { HeadphonesOffIcon, MicOffIcon, ScreenIcon } from '@/shared/ui/icon'

import { describeVoiceState, type Participant } from '../model/participant'

import type { ReactNode } from 'react'

interface ParticipantTileProps {
  participant: Participant
  /** The room knows who shares a screen; the participant itself does not. */
  screenSharing?: boolean
  /**
   * Wraps the picture and the name, e.g. with the user card. The entity cannot
   * import a feature, so the page above it supplies the surface.
   */
  renderTrigger?: (part: 'avatar' | 'name', content: ReactNode) => ReactNode
}

/** One person in a voice channel, big enough to see the speaking ring. */
export const ParticipantTile = ({
  participant,
  screenSharing = false,
  renderTrigger,
}: ParticipantTileProps) => {
  const trigger = (part: 'avatar' | 'name', content: ReactNode) => {
    return renderTrigger === undefined ? content : renderTrigger(part, content)
  }
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
      {trigger(
        'avatar',
        <Avatar
          name={participant.name}
          size={80}
          decorative
          className={cn(
            'ring-2 ring-transparent ring-offset-2 ring-offset-surface',
            participant.isSpeaking ? 'ring-success' : 'transition-shadow duration-300',
          )}
        />,
      )}
      <p className="flex w-full items-center justify-center gap-1 truncate text-sm font-medium">
        {trigger('name', <span className="truncate">{participant.name}</span>)}
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
