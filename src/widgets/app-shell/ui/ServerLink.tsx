import { NavLink } from 'react-router'

import { describeUnread, totalUnread, UnreadBadge, useWorkspaceUnread } from '@/entities/unread'
import type { WorkspaceMembership } from '@/entities/workspace'
import { cn } from '@/shared/lib/cn'

interface ServerLinkProps {
  workspace: WorkspaceMembership['workspace']
  /** The server the live stream follows; the others are polled. */
  watched: boolean
}

/** One server in the rail: its initials and whether anything there is unread. */
export const ServerLink = ({ workspace, watched }: ServerLinkProps) => {
  const { data } = useWorkspaceUnread(workspace.id, { watched })
  const total = totalUnread(data)
  const description = describeUnread(total)

  return (
    <NavLink
      to={`/s/${workspace.id}`}
      title={workspace.name}
      aria-label={description ? `${workspace.name}, ${description}` : workspace.name}
      className={({ isActive }) =>
        cn(
          'relative flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-hover text-sm font-semibold',
          isActive && 'ring-2 ring-accent',
        )
      }
    >
      <span aria-hidden="true">{workspace.name.slice(0, 2).toLocaleUpperCase('ru')}</span>
      <UnreadBadge {...total} compact className="absolute -top-1 -right-1" />
    </NavLink>
  )
}
