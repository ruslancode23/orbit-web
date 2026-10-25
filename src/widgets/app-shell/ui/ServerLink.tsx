import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router'

import { NotificationLevelContextMenu } from '@/entities/notification-setting'
import {
  describeUnread,
  totalUnread,
  UnreadBadge,
  useMarkChannelsRead,
  useWorkspaceUnread,
} from '@/entities/unread'
import { can, hasPermission, WorkspaceAvatar, type WorkspaceMembership } from '@/entities/workspace'
import { ManageInvites } from '@/features/manage-invites'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu'
import { CheckIcon, LinkIcon, SettingsIcon } from '@/shared/ui/icon'
import { useToast } from '@/shared/ui/toast'
import { Tooltip } from '@/shared/ui/tooltip'

interface ServerLinkProps {
  membership: WorkspaceMembership
  /** The server the live stream follows; the others are polled. */
  watched: boolean
}

/**
 * One server in the rail: its avatar, whether it is open, and whether anything
 * there is unread. The link says all of it in words; the marks are pictures.
 * A right click reads the whole server, invites people or opens its settings.
 */
export const ServerLink = ({ membership, watched }: ServerLinkProps) => {
  const { workspace } = membership
  const navigate = useNavigate()
  const toast = useToast()
  const [invitesOpen, setInvitesOpen] = useState(false)
  const { data } = useWorkspaceUnread(workspace.id, { watched })
  const markRead = useMarkChannelsRead(workspace.id)
  const total = totalUnread(data)
  const description = describeUnread(total)

  const canInvite = can(membership, 'canInvite')
  const canManageServer = hasPermission(membership, 'manageServer')
  const canOpenSettings = canManageServer || hasPermission(membership, 'manageRoles')

  const handleMarkRead = () => {
    const channelIds = (data ?? []).map((channel) => channel.channelId)
    markRead.mutate(channelIds, {
      onError: () => {
        toast('Не получилось отметить сервер прочитанным.', 'danger')
      },
    })
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="shrink-0">
            <Tooltip content={workspace.name} side="right">
              <NavLink
                to={`/s/${workspace.id}`}
                className="block rounded-2xl focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
              >
                {({ isActive }) => (
                  <>
                    <WorkspaceAvatar
                      name={workspace.name}
                      iconUrl={workspace.iconUrl}
                      colorKey={workspace.name}
                      active={isActive}
                      unread={total.unread > 0}
                      badge={total.mentions > 0 && <UnreadBadge {...total} compact />}
                      decorative
                    />
                    {/* The name comes from the content, so the visible initials never clash with a label. */}
                    <span className="sr-only">
                      {description ? `${workspace.name}, ${description}` : workspace.name}
                    </span>
                  </>
                )}
              </NavLink>
            </Tooltip>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent aria-label={`Действия с сервером ${workspace.name}`}>
          <ContextMenuLabel>{workspace.name}</ContextMenuLabel>
          <ContextMenuItem
            disabled={total.unread + total.mentions === 0 || markRead.isPending}
            onSelect={handleMarkRead}
          >
            <CheckIcon className="size-4 text-fg-muted" />
            Отметить прочитанным
          </ContextMenuItem>
          <ContextMenuSeparator />
          <NotificationLevelContextMenu target={{ scope: 'workspace', targetId: workspace.id }} />
          {(canInvite || canOpenSettings) && <ContextMenuSeparator />}
          {canInvite && (
            <ContextMenuItem
              onSelect={() => {
                setInvitesOpen(true)
              }}
            >
              <LinkIcon className="size-4 text-fg-muted" />
              Пригласить людей
            </ContextMenuItem>
          )}
          {canOpenSettings && (
            <ContextMenuItem
              onSelect={() => {
                void navigate(`/s/${workspace.id}/settings`)
              }}
            >
              <SettingsIcon className="size-4 text-fg-muted" />
              Настройки сервера
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {invitesOpen && (
        <ManageInvites
          workspaceId={workspace.id}
          canInvite={canInvite}
          canManage={canManageServer}
          open
          onOpenChange={setInvitesOpen}
        />
      )}
    </>
  )
}
