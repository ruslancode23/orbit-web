import { useEffect } from 'react'
import { NavLink, Outlet, useParams } from 'react-router'

import { useLive } from '@/entities/live'
import { useVoiceRoom, VoiceRoomProvider } from '@/entities/voice-room'
import { atLeast, can, useWorkspace, useWorkspaces } from '@/entities/workspace'
import { CreationNotice } from '@/features/create-workspace'
import { useMessageNotifications } from '@/features/notifications'
import { cn } from '@/shared/lib/cn'
import { MenuIcon, PlusIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { Skeleton } from '@/shared/ui/skeleton'
import { Tooltip } from '@/shared/ui/tooltip'

import { ChannelList } from './ChannelList'
import { ConnectionStatus } from './ConnectionStatus'
import { ServerLink } from './ServerLink'
import { UserPanel } from './UserPanel'
import { VoicePanel } from './VoicePanel'
import { VoiceStage } from './VoiceStage'
import { WorkspaceMenu } from './WorkspaceMenu'
import {
  setChannelSidebarOpen,
  toggleChannelSidebar,
  useChannelSidebarOpen,
} from '../model/channel-sidebar'
import { useVoiceShortcuts } from '../model/use-voice-shortcuts'

/**
 * The frame every signed-in page sits in: the servers on the left, the channels
 * of the current server beside them, the channel itself in the middle.
 *
 * What is shown follows the role the server reports — a button nobody may press
 * is not drawn — but that is a convenience, not protection: every action is
 * checked again on the server.
 *
 * The voice room lives above the routes, so changing a text channel or a server
 * never interrupts the call.
 */
export const AppShell = () => {
  return (
    <VoiceRoomProvider>
      <Shell />
    </VoiceRoomProvider>
  )
}

const Shell = () => {
  const { workspaceId, channelId } = useParams()
  const { data: memberships, isPending } = useWorkspaces()
  const { membership } = useWorkspace(workspaceId)
  const { watch } = useLive()
  const { activeChannel } = useVoiceRoom()
  const channelSidebarOpen = useChannelSidebarOpen()

  // One socket for the app; changing servers only changes what it watches.
  if (workspaceId) {
    watch(workspaceId)
  }
  useMessageNotifications({ workspaceId, channelId })
  useVoiceShortcuts()

  // A narrow screen closes the sliding channel column on Esc and after a move.
  useEffect(() => {
    if (!channelSidebarOpen) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setChannelSidebarOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [channelSidebarOpen])

  useEffect(() => {
    setChannelSidebarOpen(false)
  }, [workspaceId, channelId, activeChannel?.id])

  const canManage = atLeast(membership?.role, 'admin')
  // A member may be allowed to by the server's own settings.
  const canCreateChannels = can(membership, 'canCreateChannels')
  const canInvite = can(membership, 'canInvite')

  return (
    <div className="flex h-dvh overflow-hidden">
      <nav
        aria-label="Серверы"
        className="flex min-h-0 w-16 shrink-0 flex-col items-center gap-2 overflow-y-auto bg-surface p-2"
      >
        {memberships?.map(({ workspace }) => (
          <ServerLink
            key={workspace.id}
            workspace={workspace}
            watched={workspace.id === workspaceId}
          />
        ))}
        <span aria-hidden="true" className="h-px w-8 shrink-0 bg-border" />
        <Tooltip content="Создать сервер" side="right">
          <NavLink
            to="/new"
            aria-label="Создать сервер"
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface-hover text-fg-muted transition-colors hover:rounded-xl hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none aria-[current=page]:rounded-xl aria-[current=page]:text-fg aria-[current=page]:ring-2 aria-[current=page]:ring-accent"
          >
            <PlusIcon />
          </NavLink>
        </Tooltip>
      </nav>

      {channelSidebarOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-bg/70 lg:hidden"
          onClick={() => {
            setChannelSidebarOpen(false)
          }}
        />
      )}

      <aside
        aria-label="Каналы"
        className={cn(
          'flex min-h-0 w-64 shrink-0 flex-col border-r border-border bg-bg',
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-16 max-lg:z-40 max-lg:w-72 max-lg:shadow-popover',
          channelSidebarOpen ? 'max-lg:flex' : 'max-lg:hidden',
        )}
      >
        {isPending ? (
          <div role="status" aria-label="Загружаем сервер" className="flex flex-col gap-2 p-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : membership ? (
          <>
            <div className="shrink-0 px-2 pt-2">
              <WorkspaceMenu
                workspace={membership.workspace}
                role={membership.role}
                canManage={canManage}
                canInvite={canInvite}
                canCreateChannels={canCreateChannels}
              />
            </div>

            <ChannelList
              workspaceId={membership.workspace.id}
              activeChannelId={channelId}
              canManage={canManage}
              canInvite={canInvite}
            />
          </>
        ) : (
          <p className="p-3 text-sm text-fg-muted">
            {memberships?.length ? 'Выберите сервер' : 'Создайте свой первый сервер'}
          </p>
        )}

        {/* The person is here even on the very first screen, with no server yet. */}
        <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-border p-2">
          {activeChannel && <VoicePanel />}
          <UserPanel />
        </div>
      </aside>

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <IconButton
          label="Каналы"
          onClick={toggleChannelSidebar}
          className="absolute top-2 left-2 z-20 bg-surface shadow-popover lg:hidden"
        >
          <MenuIcon />
        </IconButton>
        <ConnectionStatus />
        <CreationNotice />
        <VoiceStage />
        <Outlet />
      </main>
    </div>
  )
}
