import { useParams } from 'react-router'

import { useChannels } from '@/entities/channel'

/**
 * The channel itself. The chat lives here from task 2.13; for now the page
 * shows which channel is open, so the shell and the routing can be used.
 */
export function ChannelPage() {
  const { workspaceId, channelId } = useParams()
  const { data: channels } = useChannels(workspaceId)
  const channel = channels?.find((item) => item.id === channelId)

  return (
    <section aria-label="Канал" className="flex flex-1 flex-col gap-2 p-6">
      <h1 className="text-xl font-semibold"># {channel?.name ?? '…'}</h1>
      {channel?.topic && <p className="text-sm text-fg-muted">{channel.topic}</p>}
      {channel && !channel.canWrite && (
        <p className="text-sm text-fg-muted">В этом канале пишут только администраторы.</p>
      )}
      <p className="text-sm text-fg-muted">Чат появится здесь на следующем шаге.</p>
    </section>
  )
}
