import { NavLink, Outlet, useParams } from 'react-router'

import { useChannels } from '@/entities/channel'
import { useLive } from '@/entities/live'
import { useSession } from '@/entities/session'
import { atLeast, useWorkspace, useWorkspaces } from '@/entities/workspace'
import { LogoutButton } from '@/features/auth'
import { CreateChannel } from '@/features/create-channel'
import { CreateWorkspace } from '@/features/create-workspace'
import { ManageMembers } from '@/features/manage-members'
import { cn } from '@/shared/lib/cn'

import { ConnectionStatus } from './ConnectionStatus'

/**
 * The frame every signed-in page sits in: the servers on the left, the channels
 * of the current server beside them, the channel itself in the middle.
 *
 * What is shown follows the role the server reports — a button nobody may press
 * is not drawn — but that is a convenience, not protection: every action is
 * checked again on the server.
 */
export const AppShell = () => {
  const { workspaceId, channelId } = useParams()
  const { user } = useSession()
  const { data: memberships, isPending } = useWorkspaces()
  const { membership } = useWorkspace(workspaceId)
  const { data: channels } = useChannels(workspaceId)
  const { watch } = useLive()

  // One socket for the app; changing servers only changes what it watches.
  if (workspaceId) watch(workspaceId)

  const canManage = atLeast(membership?.role, 'admin')
  const emptyText = !membership
    ? 'Выберите сервер слева или создайте новый'
    : channels?.length
      ? 'Выберите канал'
      : 'В этом сервере пока нет каналов'

  return (
    <div className="flex h-full">
      <nav aria-label="Серверы" className="flex w-16 flex-col items-center gap-2 bg-surface p-2">
        {memberships?.map(({ workspace }) => (
          <NavLink
            key={workspace.id}
            to={`/s/${workspace.id}`}
            title={workspace.name}
            className={({ isActive }) =>
              cn(
                'flex size-10 shrink-0 items-center justify-center rounded-md text-sm font-semibold',
                isActive ? 'bg-surface-hover ring-2 ring-accent' : 'bg-surface-hover',
              )
            }
          >
            {workspace.name.slice(0, 2).toLocaleUpperCase('ru')}
          </NavLink>
        ))}
        <CreateWorkspace />
      </nav>

      <aside aria-label="Каналы" className="flex w-56 flex-col gap-2 border-r border-border p-3">
        {isPending ? (
          <p role="status" className="text-sm text-fg-muted">
            Загружаем…
          </p>
        ) : membership ? (
          <>
            <h2 className="truncate text-sm font-semibold">{membership.workspace.name}</h2>
            <ul className="flex flex-col gap-1">
              {channels?.map((channel) => (
                <li key={channel.id}>
                  <NavLink
                    to={`/s/${membership.workspace.id}/${channel.id}`}
                    className={({ isActive }) =>
                      cn(
                        'block truncate rounded-md px-2 py-1 text-sm',
                        isActive ? 'bg-surface-hover' : 'hover:bg-surface',
                      )
                    }
                  >
                    # {channel.name}
                  </NavLink>
                </li>
              ))}
            </ul>
            {canManage && <CreateChannel workspaceId={membership.workspace.id} />}
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
          <ConnectionStatus />
          {user && <p className="truncate text-sm text-fg-muted">{user.nickname}</p>}
          <LogoutButton />
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {channelId ? <Outlet /> : <p className="m-auto text-sm text-fg-muted">{emptyText}</p>}
      </main>
    </div>
  )
}
