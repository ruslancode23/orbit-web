import { NavLink } from 'react-router'

import { describeUnread, totalUnread, UnreadBadge, useWorkspaceUnread } from '@/entities/unread'
import { WorkspaceAvatar, type Workspace } from '@/entities/workspace'
import { Tooltip } from '@/shared/ui/tooltip'

interface ServerLinkProps {
  workspace: Workspace
  /** The server the live stream follows; the others are polled. */
  watched: boolean
}

/**
 * One server in the rail: its avatar, whether it is open, and whether anything
 * there is unread. The link says all of it in words; the marks are pictures.
 */
export const ServerLink = ({ workspace, watched }: ServerLinkProps) => {
  const { data } = useWorkspaceUnread(workspace.id, { watched })
  const total = totalUnread(data)
  const description = describeUnread(total)

  return (
    <Tooltip content={workspace.name} side="right">
      <NavLink
        to={`/s/${workspace.id}`}
        className="rounded-2xl focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none"
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
  )
}
