import { useState } from 'react'

import { initials } from '@/entities/participant'
import { cn } from '@/shared/lib/cn'
import { HeadphonesOffIcon, MicOffIcon, ScreenIcon } from '@/shared/ui/icon'

import type { VoiceChannelMember } from '../model/members'

const SHOWN = 5

/** Who is in a voice channel, before joining it: names, mute, screen and speech. */
export const VoiceChannelMembers = ({
  channelName,
  members,
}: {
  channelName: string
  members: VoiceChannelMember[]
}) => {
  const [expanded, setExpanded] = useState(false)
  if (members.length === 0) {
    return null
  }
  const hidden = members.length - SHOWN
  const shown = expanded ? members : members.slice(0, SHOWN)

  return (
    <div className="flex flex-col gap-0.5 pl-7">
      <ul aria-label={`Участники канала ${channelName}`} className="flex flex-col gap-0.5">
        {shown.map((member) => (
          <li key={member.id} className="flex items-center gap-1 text-xs text-fg-muted">
            <span
              aria-hidden="true"
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-hover text-[10px] font-semibold ring-2 ring-transparent',
                member.speaking && 'ring-success',
              )}
            >
              {initials(member.name)}
            </span>
            <span className="min-w-0 truncate">{member.name}</span>
            <span className="ml-auto flex shrink-0 items-center gap-1">
              {member.screenSharing && (
                <span title="Показывает экран">
                  <ScreenIcon className="size-3" />
                  <span className="sr-only">показывает экран</span>
                </span>
              )}
              {member.deafened ? (
                <span title="Звук выключен">
                  <HeadphonesOffIcon className="size-3 text-danger" />
                  <span className="sr-only">звук выключен</span>
                </span>
              ) : (
                member.muted && (
                  <span title="Микрофон выключен">
                    <MicOffIcon className="size-3 text-danger" />
                    <span className="sr-only">микрофон выключен</span>
                  </span>
                )
              )}
            </span>
          </li>
        ))}
      </ul>
      {hidden > 0 && !expanded && (
        <button
          type="button"
          className="self-start rounded text-xs text-fg-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          onClick={() => {
            setExpanded(true)
          }}
        >
          +{hidden}
        </button>
      )}
      {expanded && hidden > 0 && (
        <button
          type="button"
          className="self-start rounded text-xs text-fg-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          onClick={() => {
            setExpanded(false)
          }}
        >
          Свернуть
        </button>
      )}
    </div>
  )
}
