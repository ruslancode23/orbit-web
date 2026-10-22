import type { Channel } from '@/entities/channel'
import { useMarkChannelsRead } from '@/entities/unread'
import { copyText } from '@/shared/lib/clipboard'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu'
import { CheckIcon, CopyIcon, LinkIcon, SettingsIcon } from '@/shared/ui/icon'
import { useToast } from '@/shared/ui/toast'

import type { ReactNode } from 'react'

interface ChannelContextMenuProps {
  workspaceId: string
  channel: Channel
  /** Anything unread here; without it «Отметить прочитанным» has nothing to do. */
  hasUnread: boolean
  canInvite: boolean
  /** manageChannels in this channel, overrides included. */
  canManage: boolean
  onInvite: () => void
  onEdit: () => void
  children: ReactNode
}

const channelUrl = (workspaceId: string, channelId: string): string =>
  new URL(`/s/${workspaceId}/${channelId}`, globalThis.location.origin).toString()

/**
 * Right click on a channel row: read it, copy a link to it, and the invite and
 * settings buttons the row already shows on hover.
 */
export const ChannelContextMenu = ({
  workspaceId,
  channel,
  hasUnread,
  canInvite,
  canManage,
  onInvite,
  onEdit,
  children,
}: ChannelContextMenuProps) => {
  const toast = useToast()
  const markRead = useMarkChannelsRead(workspaceId)

  const handleMarkRead = () => {
    markRead.mutate([channel.id], {
      onError: () => {
        toast('Не получилось отметить канал прочитанным.', 'danger')
      },
    })
  }

  const handleCopyLink = async () => {
    const done = await copyText(channelUrl(workspaceId, channel.id))
    toast(
      done ? 'Ссылка скопирована' : 'Не удалось скопировать ссылку.',
      done ? 'success' : 'danger',
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent aria-label={`Действия с каналом ${channel.name}`}>
        <ContextMenuLabel>
          {channel.kind === 'text' ? `# ${channel.name}` : channel.name}
        </ContextMenuLabel>
        {channel.kind === 'text' && (
          <ContextMenuItem disabled={!hasUnread || markRead.isPending} onSelect={handleMarkRead}>
            <CheckIcon className="size-4 text-fg-muted" />
            Отметить прочитанным
          </ContextMenuItem>
        )}
        <ContextMenuItem onSelect={() => void handleCopyLink()}>
          <CopyIcon className="size-4 text-fg-muted" />
          Копировать ссылку
        </ContextMenuItem>
        {(canInvite || canManage) && <ContextMenuSeparator />}
        {canInvite && (
          <ContextMenuItem onSelect={onInvite}>
            <LinkIcon className="size-4 text-fg-muted" />
            Пригласить людей
          </ContextMenuItem>
        )}
        {canManage && (
          <ContextMenuItem onSelect={onEdit}>
            <SettingsIcon className="size-4 text-fg-muted" />
            Настройки канала
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
