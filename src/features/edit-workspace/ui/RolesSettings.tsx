import { useState } from 'react'

import { useSession } from '@/entities/session'
import {
  describeRoleError,
  hasPermission,
  rankOf,
  useRoleEditing,
  useRoles,
  useWorkspace,
  useWorkspaceMembers,
  type Role,
} from '@/entities/workspace'
import { accentOf } from '@/shared/lib/accent'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import { ChevronDownIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { Skeleton } from '@/shared/ui/skeleton'

import { RoleEditor } from './RoleEditor'

interface RolesSettingsProps {
  workspaceId: string
}

/**
 * The roles of a server: their order, and the editor of the one picked. Only
 * roles below the reader's highest may be changed or moved, as on the server;
 * the others are shown for context. @everyone stays at the bottom.
 */
export const RolesSettings = ({ workspaceId }: RolesSettingsProps) => {
  const { user } = useSession()
  const myId = user?.id
  const { membership } = useWorkspace(workspaceId)
  const { data: roles, isPending } = useRoles(workspaceId)
  const { data: members } = useWorkspaceMembers(workspaceId)
  const editing = useRoleEditing(workspaceId)
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const me = members?.find((member) => member.user.id === myId)
  const myRank = rankOf(me, roles)
  const canManageRoles = hasPermission(membership, 'manageRoles')
  const manages = (role: Role) => canManageRoles && (role.isDefault || role.position < myRank)

  if (isPending) {
    return (
      <div role="status" aria-label="Загружаем роли" className="flex flex-col gap-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  const list = roles ?? []
  const ordered = list.filter((role) => !role.isDefault)
  const selected = list.find((role) => role.id === selectedId)
  const holders = (role: Role) =>
    role.isDefault
      ? (members?.length ?? 0)
      : (members?.filter((member) => member.roleIds?.includes(role.id)).length ?? 0)

  const move = (role: Role, step: -1 | 1) => {
    const index = ordered.findIndex((item) => item.id === role.id)
    const target = index + step
    if (index === -1 || target < 0 || target >= ordered.length) {
      return
    }
    const ids = ordered.map((item) => item.id)
    const [moved] = ids.splice(index, 1)
    if (moved === undefined) {
      return
    }
    ids.splice(target, 0, moved)
    setError(null)
    editing.reorder.mutate(
      { path: { workspaceId }, body: { roleIds: ids } },
      {
        onError: (failure) => {
          setError(describeRoleError(failure))
        },
      },
    )
  }

  const create = () => {
    setError(null)
    editing.create.mutate(
      { path: { workspaceId }, body: { name: 'Новая роль' } },
      {
        onSuccess: (role) => {
          setSelectedId(role.id)
        },
        onError: (failure) => {
          setError(describeRoleError(failure))
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fg-muted">
        Права складываются из ролей участника. Роли выше в списке старше: менять и выдавать можно
        только роли ниже своей высшей.
      </p>

      <ul aria-label="Роли" className="flex flex-col gap-1">
        {list.map((role) => {
          const accent = accentOf(role.color)
          const position = ordered.findIndex((item) => item.id === role.id)
          const movable = !role.isDefault && manages(role)
          return (
            <li
              key={role.id}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5',
                role.id === selectedId && 'bg-surface-hover',
              )}
            >
              <span
                aria-hidden="true"
                className={cn('size-3 shrink-0 rounded-full', accent?.swatch ?? 'bg-border')}
              />
              <button
                type="button"
                aria-label={`Изменить роль ${role.name}`}
                aria-pressed={role.id === selectedId}
                className="min-w-0 flex-1 truncate text-left text-sm text-fg hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                onClick={() => {
                  setSelectedId(role.id)
                }}
              >
                {role.name}
              </button>
              <span className="shrink-0 text-xs text-fg-muted">{holders(role)}</span>
              {movable && (
                <>
                  <IconButton
                    label={`Поднять роль ${role.name}`}
                    size="sm"
                    disabled={position <= 0 || !manages(ordered[position - 1] ?? role)}
                    onClick={() => {
                      move(role, -1)
                    }}
                  >
                    <ChevronDownIcon className="size-4 rotate-180" />
                  </IconButton>
                  <IconButton
                    label={`Опустить роль ${role.name}`}
                    size="sm"
                    disabled={position >= ordered.length - 1}
                    onClick={() => {
                      move(role, 1)
                    }}
                  >
                    <ChevronDownIcon className="size-4" />
                  </IconButton>
                </>
              )}
            </li>
          )
        })}
      </ul>

      {canManageRoles && (
        <div>
          <Button
            type="button"
            variant="ghost"
            disabled={editing.create.isPending}
            onClick={create}
          >
            Создать роль
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {selected && (
        <RoleEditor
          key={selected.id}
          workspaceId={workspaceId}
          role={selected}
          editable={manages(selected)}
          grantable={(permission) => hasPermission(membership, permission)}
          onDeleted={() => {
            setSelectedId(undefined)
          }}
        />
      )}
    </div>
  )
}
