import { isApiError, type Channel } from '@/shared/api'
import { Button } from '@/shared/ui/button'
import { SpeakerIcon } from '@/shared/ui/icon'

import { VoiceChannelMembers } from './VoiceChannelMembers'
import { useVoiceChannel } from '../model/useVoiceChannel'

import type { VoiceChannelMember } from '../model/members'

interface VoiceChannelButtonProps {
  channel: Channel
  /** Who is already there, from server presence or the live room of this client. */
  members?: VoiceChannelMember[]
}

/**
 * A voice channel in the sidebar. One click connects: the account comes from
 * the session, and the server decides whether this member may speak.
 */
export const VoiceChannelButton = ({ channel, members = [] }: VoiceChannelButtonProps) => {
  const { connect, activeChannel, connecting, error } = useVoiceChannel()
  const active = activeChannel?.id === channel.id

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="ghost"
        aria-label={`Голосовой канал ${channel.name}`}
        aria-pressed={active}
        disabled={connecting}
        className="w-full justify-start aria-pressed:bg-surface-hover aria-pressed:text-fg"
        onClick={() => {
          void connect(channel)
        }}
      >
        <SpeakerIcon className={active ? 'shrink-0 text-success' : 'shrink-0'} />
        <span className="min-w-0 truncate">{channel.name}</span>
        {active && <span className="ml-auto text-xs text-success">в эфире</span>}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {describeVoiceError(error)}
        </p>
      )}
      <VoiceChannelMembers channelName={channel.name} members={members} />
    </div>
  )
}

const describeVoiceError = (error: unknown): string => {
  if (!isApiError(error)) {
    return 'Не получилось подключиться к каналу.'
  }
  if (error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  if (error.status === 404) {
    return 'Канал больше не существует.'
  }
  return 'Не получилось подключиться к каналу.'
}
