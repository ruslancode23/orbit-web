import { useParams } from 'react-router'

import { useChannels } from '@/entities/channel'
import { useWorkspace } from '@/entities/workspace'

/** The middle of the shell when no channel is open: a hint at what to do next. */
export const ShellPlaceholder = () => {
  const { workspaceId } = useParams()
  const { membership } = useWorkspace(workspaceId)
  const { data: channels } = useChannels(workspaceId)

  const text = !membership
    ? 'Выберите сервер слева или создайте новый'
    : channels?.length
      ? 'Выберите канал'
      : 'В этом сервере пока нет каналов'

  return <p className="m-auto text-sm text-fg-muted">{text}</p>
}
