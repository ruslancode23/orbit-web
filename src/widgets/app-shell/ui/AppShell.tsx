import { Link, NavLink, Outlet, useParams } from 'react-router'

import { useChannels } from '@/entities/channel'
import { useLive } from '@/entities/live'
import { useSession } from '@/entities/session'
import { describeUnread, UnreadBadge, useWorkspaceUnread } from '@/entities/unread'
import { useVoicePresence } from '@/entities/voice-presence'
import { useVoiceRoom, VoiceRoomProvider } from '@/entities/voice-room'
import { atLeast, can, useWorkspace, useWorkspaces, WorkspaceAvatar } from '@/entities/workspace'
import { LogoutButton } from '@/features/auth'
import { ClaimGuest } from '@/features/claim-guest'
import { CreateChannel } from '@/features/create-channel'
import { CreationNotice } from '@/features/create-workspace'
import { InstallApp } from '@/features/install-app'
import {
  membersFromPresence,
  membersFromRoom,
  VoiceChannelButton,
} from '@/features/join-voice-channel'
import { ManageInvites } from '@/features/manage-invites'
import { ManageMembers } from '@/features/manage-members'
import { NotificationSettings, useMessageNotifications } from '@/features/notifications'
import { cn } from '@/shared/lib/cn'
import { SettingsIcon } from '@/shared/ui/icon'
import { Tooltip } from '@/shared/ui/tooltip'

import { ConnectionStatus } from './ConnectionStatus'
import { ServerLink } from './ServerLink'
import { VoicePanel } from './VoicePanel'
import { VoiceStage } from './VoiceStage'

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
  const { user } = useSession()
  const { data: memberships, isPending } = useWorkspaces()
  const { membership } = useWorkspace(workspaceId)
  const { data: channels } = useChannels(workspaceId)
  const { data: voicePresence } = useVoicePresence(workspaceId)
  const {
    activeChannel,
    participants: roomParticipants,
    screenShares,
    isSharingScreen,
    room,
  } = useVoiceRoom()
  const { data: unread } = useWorkspaceUnread(workspaceId, { watched: true })
  const { watch } = useLive()

  // One socket for the app; changing servers only changes what it watches.
  if (workspaceId) {
    watch(workspaceId)
  }
  useMessageNotifications({ workspaceId, channelId })

  const canManage = atLeast(membership?.role, 'admin')
  // A member may be allowed to by the server's own settings.
  const canCreateChannels = can(membership, 'canCreateChannels')
  const canInvite = can(membership, 'canInvite')

  return (
    <div className="flex h-full">
      <nav aria-label="Серверы" className="flex w-16 flex-col items-center gap-2 bg-surface p-2">
        {memberships?.map(({ workspace }) => (
          <ServerLink
            key={workspace.id}
            workspace={workspace}
            watched={workspace.id === workspaceId}
          />
        ))}
        <Tooltip content="Создать сервер" side="right">
          {/* A plain class string: the tooltip trigger merges classes as text,
              so NavLink's class function would not survive it. */}
          <NavLink
            to="/new"
            aria-label="Создать сервер"
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface-hover text-xl text-fg-muted transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none aria-[current=page]:rounded-xl aria-[current=page]:text-fg aria-[current=page]:ring-2 aria-[current=page]:ring-accent"
          >
            <span aria-hidden="true">+</span>
          </NavLink>
        </Tooltip>
      </nav>

      <aside aria-label="Каналы" className="flex w-56 flex-col gap-2 border-r border-border p-3">
        {isPending ? (
          <p role="status" className="text-sm text-fg-muted">
            Загружаем…
          </p>
        ) : membership ? (
          <>
            <header className="flex items-center gap-2">
              <WorkspaceAvatar
                name={membership.workspace.name}
                iconUrl={membership.workspace.iconUrl}
                colorKey={membership.workspace.id}
                size="sm"
                decorative
              />
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
                {membership.workspace.name}
              </h2>
              {canManage && (
                <Tooltip content="Настройки сервера">
                  <Link
                    to={`/s/${membership.workspace.id}/settings`}
                    aria-label="Настройки сервера"
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                  >
                    <SettingsIcon />
                  </Link>
                </Tooltip>
              )}
            </header>
            <ul className="flex flex-col gap-1">
              {channels?.map((channel) => {
                const counts = unread?.find((item) => item.channelId === channel.id)
                // The open channel is being read: its count would only flicker.
                const shown =
                  counts && channel.id !== channelId
                    ? { unread: counts.unread, mentions: counts.mentions }
                    : { unread: 0, mentions: 0 }
                const description = describeUnread(shown)
                if (channel.kind === 'voice') {
                  const current = activeChannel?.id === channel.id
                  const screenSharers = screenShares.map((share) => share.participantIdentity)
                  if (current && isSharingScreen && room) {
                    screenSharers.push(room.localParticipant.identity)
                  }
                  const members = current
                    ? membersFromRoom(roomParticipants, screenSharers)
                    : membersFromPresence(
                        voicePresence?.find((presence) => presence.channelId === channel.id),
                      )
                  return (
                    <li key={channel.id}>
                      <VoiceChannelButton channel={channel} members={members} />
                    </li>
                  )
                }
                return (
                  <li key={channel.id}>
                    <NavLink
                      to={`/s/${membership.workspace.id}/${channel.id}`}
                      aria-label={
                        description ? `# ${channel.name}, ${description}` : `# ${channel.name}`
                      }
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2 rounded-md px-2 py-1 text-sm',
                          isActive ? 'bg-surface-hover' : 'hover:bg-surface',
                          shown.unread > 0 ? 'font-semibold text-fg' : 'text-fg-muted',
                          isActive && 'text-fg',
                        )
                      }
                    >
                      <span className="min-w-0 flex-1 truncate"># {channel.name}</span>
                      <UnreadBadge unread={shown.unread} mentions={shown.mentions} />
                    </NavLink>
                  </li>
                )
              })}
            </ul>
            {canCreateChannels && <CreateChannel workspaceId={membership.workspace.id} />}
            <ManageInvites
              workspaceId={membership.workspace.id}
              canInvite={canInvite}
              canManage={canManage}
            />
            {canManage && (
              <ManageMembers workspaceId={membership.workspace.id} role={membership.role} />
            )}
          </>
        ) : (
          <p className="text-sm text-fg-muted">
            {memberships?.length ? 'Выберите сервер' : 'Создайте свой первый сервер'}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-2">
          <VoicePanel />
          <InstallApp />
          <ClaimGuest />
          <NotificationSettings />
          <ConnectionStatus />
          {user && (
            <p className="truncate text-sm text-fg-muted">
              {user.nickname}
              {user.isGuest && <span className="text-xs"> (гость)</span>}
            </p>
          )}
          <LogoutButton />
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <CreationNotice />
        <VoiceStage />
        <Outlet />
      </main>
    </div>
  )
}
