import { useParams } from 'react-router'

import { useChannels } from '@/entities/channel'
import { can, useWorkspace } from '@/entities/workspace'
import { VoiceChannelButton } from '@/features/join-voice-channel'
import { ChannelChat } from '@/widgets/channel-chat'

/** One channel: its name and topic above, the chat below. */
const ChannelPage = () => {
  const { workspaceId, channelId } = useParams()
  const { data: channels } = useChannels(workspaceId)
  const channel = channels?.find((item) => item.id === channelId)
  const { membership } = useWorkspace(workspaceId)

  if (!workspaceId || !channelId) {
    return null
  }

  if (channel?.kind === 'voice') {
    return (
      <section
        aria-label="Голосовой канал"
        className="flex flex-1 flex-col items-center justify-center gap-3 p-6"
      >
        <h1 className="text-lg font-semibold">🔊 {channel.name}</h1>
        <p className="max-w-sm text-center text-sm text-fg-muted">
          Это голосовой канал. Подключитесь, чтобы говорить и слышать участников.
        </p>
        <VoiceChannelButton channel={channel} />
      </section>
    )
  }

  return (
    <section aria-label="Канал" className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold"># {channel?.name ?? '…'}</h1>
        {channel?.topic && <p className="text-sm text-fg-muted">{channel.topic}</p>}
      </header>
      <ChannelChat
        workspaceId={workspaceId}
        channelId={channelId}
        canWrite={channel?.canWrite ?? false}
        canAttach={can(membership, 'canAttachFiles')}
      />
    </section>
  )
}

export default ChannelPage
