import { Link } from 'react-router'

import { useMutual, UserAvatar, UserName } from '@/entities/user'
import { ROLE_NAME, WorkspaceAvatar } from '@/entities/workspace'
import type { MutualServer, UserProfile } from '@/shared/api'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

interface MutualTabsProps {
  profile: UserProfile
  /**
   * Opens another person's full profile in the same dialog. The mutual list
   * already carries the profile, so the next card draws without a request.
   */
  onOpenPerson?: (userId: string) => void
  /** Closes the dialog before a server link takes the reader away. */
  onLeave?: () => void
}

const ROW_CLASS =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none'

const Empty = ({ title, description }: { title: string; description: string }) => {
  return (
    <div role="status" className="flex flex-col gap-1 px-2 py-6 text-center">
      <p className="text-sm font-medium text-fg">{title}</p>
      <p className="text-sm text-fg-muted">{description}</p>
    </div>
  )
}

const ServerRow = ({ server, onLeave }: { server: MutualServer; onLeave?: () => void }) => {
  const role = ROLE_NAME[server.role]

  return (
    <li>
      <Link
        to={`/s/${server.id}`}
        aria-label={`${server.name}, ваша роль: ${role}`}
        className={ROW_CLASS}
        onClick={onLeave}
      >
        <WorkspaceAvatar
          name={server.name}
          iconUrl={server.iconUrl}
          colorKey={server.id}
          size="sm"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-fg">{server.name}</span>
          <span className="truncate text-xs text-fg-muted">Ваша роль: {role}</span>
        </span>
      </Link>
    </li>
  )
}

const PersonRow = ({ person, onOpen }: { person: UserProfile; onOpen?: () => void }) => {
  const content = (
    <>
      <UserAvatar profile={person} size={32} decorative />
      <UserName profile={person} className="min-w-0 flex-1 text-sm" />
    </>
  )

  if (!onOpen) {
    return <li className={ROW_CLASS}>{content}</li>
  }

  return (
    <li>
      <button type="button" className={ROW_CLASS} onClick={onOpen}>
        {content}
      </button>
    </li>
  )
}

/**
 * «Общие серверы» and «Общие друзья» of a full profile. The answer is the
 * intersection the server computed: a server both accounts are on, a friend
 * both of them have. The tab only appears when there is at least one item —
 * a pair that shares nothing sees no empty section. An individual empty list
 * still gets its own sentence, so switching tabs never shows a blank panel.
 *
 * A 400 (the reader's own account) or 404 (a stranger or a blocked pair)
 * arrives here as `null`: the slot stays away, and the profile around it is
 * untouched.
 */
export const MutualTabs = ({ profile, onOpenPerson, onLeave }: MutualTabsProps) => {
  const { data } = useMutual(profile.id)

  if (!data || (data.servers.length === 0 && data.friends.length === 0)) {
    return null
  }

  return (
    <Tabs
      defaultValue={data.servers.length > 0 ? 'servers' : 'friends'}
      className="flex flex-col gap-2 border-t border-border pt-3"
    >
      <TabsList aria-label="Общие серверы и друзья" className="bg-surface">
        <TabsTrigger value="servers">Общие серверы</TabsTrigger>
        <TabsTrigger value="friends">Общие друзья</TabsTrigger>
      </TabsList>

      <TabsContent value="servers">
        {data.servers.length === 0 ? (
          <Empty
            title="Общих серверов нет"
            description="Вы не состоите с этим человеком ни на одном сервере."
          />
        ) : (
          <ul aria-label="Общие серверы" className="flex flex-col gap-0.5">
            {data.servers.map((server) => (
              <ServerRow key={server.id} server={server} onLeave={onLeave} />
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="friends">
        {data.friends.length === 0 ? (
          <Empty
            title="Общих друзей нет"
            description="Среди ваших друзей и друзей этого человека пока нет общих."
          />
        ) : (
          <ul aria-label="Общие друзья" className="flex flex-col gap-0.5">
            {data.friends.map((friend) => (
              <PersonRow
                key={friend.id}
                person={friend}
                {...(onOpenPerson === undefined
                  ? {}
                  : {
                      onOpen: () => {
                        onOpenPerson(friend.id)
                      },
                    })}
              />
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  )
}
