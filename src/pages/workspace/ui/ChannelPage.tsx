import { useParams } from 'react-router'

import { useChannels } from '@/entities/channel'
import { ChannelChat } from '@/widgets/channel-chat'

/** One channel: its name and topic above, the chat below. */
export function ChannelPage() {
  const { workspaceId, channelId } = useParams()
  const { data: channels } = useChannels(workspaceId)
  const channel = channels?.find((item) => item.id === channelId)

  if (!channelId) return null

  return (
    <section aria-label="Канал" className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold"># {channel?.name ?? '…'}</h1>
        {channel?.topic && <p className="text-sm text-fg-muted">{channel.topic}</p>}
      </header>
      <ChannelChat channelId={channelId} canWrite={channel?.canWrite ?? false} />
    </section>
  )
}
