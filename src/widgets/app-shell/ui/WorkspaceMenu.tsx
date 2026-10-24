import { useState } from 'react'
import { useNavigate } from 'react-router'

import { MessageSearch } from '@/entities/message'
import { NotificationLevelDropdownMenu } from '@/entities/notification-setting'
import {
  useWorkspaceMembers,
  WorkspaceAvatar,
  type Workspace,
  type WorkspaceRole,
} from '@/entities/workspace'
import { CreateChannel } from '@/features/create-channel'
import { ManageInvites } from '@/features/manage-invites'
import { ManageMembers } from '@/features/manage-members'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import {
  ChevronDownIcon,
  LinkIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'

interface WorkspaceMenuProps {
  workspace: Workspace
  role: WorkspaceRole
  /** The list of invite links: manageServer. */
  canManageServer: boolean
  /** «Настройки сервера»: manageServer or manageRoles. */
  canOpenSettings: boolean
  /** «Участники и баны»: kickMembers or banMembers. */
  canModerate: boolean
  canInvite: boolean
  canCreateChannels: boolean
}

/**
 * The header of the channel column: the server's name and everything that may
 * be done to the server itself — invite people, create a channel, look at the
 * members, open the server settings.
 */
export const WorkspaceMenu = ({
  workspace,
  role,
  canManageServer,
  canOpenSettings,
  canModerate,
  canInvite,
  canCreateChannels,
}: WorkspaceMenuProps) => {
  const navigate = useNavigate()
  const [invitesOpen, setInvitesOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { data: members } = useWorkspaceMembers(workspace.id)
  const people = (members ?? []).map((member) => ({
    id: member.user.id,
    nickname: member.user.nickname,
    displayName: member.user.displayName,
  }))

  return (
    <>
      <header className="flex shrink-0 items-center gap-2 px-1 py-1">
        <WorkspaceAvatar
          name={workspace.name}
          iconUrl={workspace.iconUrl}
          colorKey={workspace.name}
          size="sm"
          decorative
        />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{workspace.name}</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="Меню сервера" size="sm">
              <ChevronDownIcon />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {canInvite && (
              <DropdownMenuItem
                onSelect={() => {
                  setInvitesOpen(true)
                }}
              >
                <LinkIcon className="size-4 text-fg-muted" />
                Пригласить людей
              </DropdownMenuItem>
            )}
            {canCreateChannels && (
              <DropdownMenuItem
                onSelect={() => {
                  setCreateOpen(true)
                }}
              >
                <PlusIcon className="size-4 text-fg-muted" />
                Создать канал
              </DropdownMenuItem>
            )}
            {canModerate && (
              <DropdownMenuItem
                onSelect={() => {
                  setMembersOpen(true)
                }}
              >
                <UsersIcon className="size-4 text-fg-muted" />
                Участники и баны
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() => {
                setSearchOpen(true)
              }}
            >
              <SearchIcon className="size-4 text-fg-muted" />
              Поиск по серверу
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <NotificationLevelDropdownMenu
              target={{ scope: 'workspace', targetId: workspace.id }}
            />
            {canOpenSettings && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    void navigate(`/s/${workspace.id}/settings`)
                  }}
                >
                  <SettingsIcon className="size-4 text-fg-muted" />
                  Настройки сервера
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <ManageInvites
        workspaceId={workspace.id}
        canInvite={canInvite}
        canManage={canManageServer}
        open={invitesOpen}
        onOpenChange={setInvitesOpen}
      />
      <CreateChannel workspaceId={workspace.id} open={createOpen} onOpenChange={setCreateOpen} />
      <ManageMembers
        workspaceId={workspace.id}
        role={role}
        open={membersOpen}
        onOpenChange={setMembersOpen}
      />
      <MessageSearch
        workspaceId={workspace.id}
        people={people}
        defaultScope="workspace"
        open={searchOpen}
        onOpenChange={setSearchOpen}
        hotkey={false}
      />
    </>
  )
}
