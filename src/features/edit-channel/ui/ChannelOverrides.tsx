import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

import {
  channelAllows,
  useChannelOverrides,
  useSetChannelOverride,
  type Channel,
  type ChannelOverride,
} from '@/entities/channel'
import { useSession } from '@/entities/session'
import {
  describeRoleError,
  PERMISSIONS,
  rankOf,
  useRoles,
  useWorkspaceMembers,
  type Permission,
  type Role,
} from '@/entities/workspace'
import { accentOf } from '@/shared/lib/accent'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

interface ChannelOverridesProps {
  workspaceId: string
  channel: Channel
}

type OverrideState = 'deny' | 'inherit' | 'allow'

const STATES: { value: OverrideState; label: string }[] = [
  { value: 'deny', label: 'Запретить' },
  { value: 'inherit', label: 'Как на сервере' },
  { value: 'allow', label: 'Разрешить' },
]

const CHANNEL_PERMISSIONS = PERMISSIONS.filter((item) => item.channel)

/**
 * What each role may do differently in this channel, as Discord does it: per
 * permission, deny, allow or leave it to the server. @everyone first — that is
 * how a channel is closed to everyone and opened to one role.
 */
export const ChannelOverrides = ({ workspaceId, channel }: ChannelOverridesProps) => {
  const { user } = useSession()
  const { data: roles } = useRoles(workspaceId)
  const { data: members } = useWorkspaceMembers(workspaceId)
  const { data: overrides, isPending } = useChannelOverrides(channel.id, true)
  const [roleId, setRoleId] = useState<string | undefined>(undefined)

  const me = members?.find((member) => member.user.id === user?.id)
  const myRank = rankOf(me, roles)
  // @everyone first, then the roles highest first, as Discord lists them.
  const ordered = [
    ...(roles ?? []).filter((role) => role.isDefault),
    ...(roles ?? []).filter((role) => !role.isDefault),
  ]
  const selected = ordered.find((role) => role.id === roleId) ?? ordered[0]

  if (isPending || roles === undefined) {
    return (
      <div role="status" aria-label="Загружаем права канала" className="flex flex-col gap-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fg-muted">
        Права ролей в этом канале. «Как на сервере» оставляет то, что роль даёт на всём сервере.
      </p>
      <ul aria-label="Роли канала" className="flex flex-wrap gap-1">
        {ordered.map((role) => {
          const touched = overrides?.some((item) => item.roleId === role.id) ?? false
          return (
            <li key={role.id}>
              <button
                type="button"
                aria-pressed={role.id === selected?.id}
                aria-label={`Права роли ${role.name}`}
                className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-sm text-fg hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none aria-pressed:border-accent aria-pressed:bg-surface-hover"
                onClick={() => {
                  setRoleId(role.id)
                }}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-2.5 rounded-full',
                    accentOf(role.color)?.swatch ?? 'bg-border',
                  )}
                />
                {role.name}
                {touched && <span className="text-xs text-fg-muted">· изменена</span>}
              </button>
            </li>
          )
        })}
      </ul>

      {selected && (
        <OverrideForm
          key={selected.id}
          workspaceId={workspaceId}
          channel={channel}
          role={selected}
          override={overrides?.find((item) => item.roleId === selected.id)}
          editable={selected.isDefault || selected.position < myRank}
        />
      )}
    </div>
  )
}

interface OverrideFormProps {
  workspaceId: string
  channel: Channel
  role: Role
  override: ChannelOverride | undefined
  /** The role is below the reader's highest, or is @everyone. */
  editable: boolean
}

type OverrideValues = Partial<Record<Permission, OverrideState>>

const valuesOf = (override: ChannelOverride | undefined): OverrideValues => {
  const values: OverrideValues = {}
  for (const permission of override?.allow ?? []) {
    values[permission] = 'allow'
  }
  for (const permission of override?.deny ?? []) {
    values[permission] = 'deny'
  }
  return values
}

/** One role's override: a three-way choice per permission, saved together. */
const OverrideForm = ({ workspaceId, channel, role, override, editable }: OverrideFormProps) => {
  const save = useSetChannelOverride(workspaceId, channel.id)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const { control, handleSubmit, reset, formState } = useForm<{ states: OverrideValues }>({
    values: { states: valuesOf(override) },
    resetOptions: { keepDirtyValues: true },
  })

  const submit = handleSubmit(async ({ states }) => {
    setError(null)
    setSaved(false)
    const allow: Permission[] = []
    const deny: Permission[] = []
    for (const { permission } of CHANNEL_PERMISSIONS) {
      if (states[permission] === 'allow') {
        allow.push(permission)
      } else if (states[permission] === 'deny') {
        deny.push(permission)
      }
    }
    try {
      await save.mutateAsync({
        path: { channelId: channel.id, roleId: role.id },
        body: { allow, deny },
      })
    } catch (failure) {
      setError(describeRoleError(failure))
      return
    }
    reset({ states })
    setSaved(true)
  })

  return (
    <form
      aria-label={`Права роли ${role.name} в канале`}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        void submit(event)
      }}
    >
      {!editable && (
        <p className="text-sm text-fg-muted">
          Эта роль не ниже вашей: её права можно только посмотреть.
        </p>
      )}
      <Controller
        control={control}
        name="states"
        render={({ field }) => (
          <div className="flex flex-col gap-3">
            {CHANNEL_PERMISSIONS.map((item) => {
              const current = field.value[item.permission] ?? 'inherit'
              // Nobody hands out, or takes away here, what they lack in this channel.
              const locked = !editable || !channelAllows(channel, item.permission, true)
              return (
                <fieldset key={item.permission} disabled={locked} className="flex flex-col gap-1">
                  <legend className="text-sm text-fg">{item.title}</legend>
                  <div className="flex gap-1">
                    {STATES.map((state) => (
                      <label
                        key={state.value}
                        className={cn(
                          'flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-fg-muted has-checked:text-fg has-focus-visible:ring-2 has-focus-visible:ring-accent has-disabled:cursor-not-allowed has-disabled:opacity-60',
                          current === state.value &&
                            (state.value === 'deny'
                              ? 'border-danger'
                              : state.value === 'allow'
                                ? 'border-success'
                                : 'bg-surface-hover'),
                        )}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={`${role.id}-${item.permission}`}
                          value={state.value}
                          checked={current === state.value}
                          onChange={() => {
                            field.onChange({ ...field.value, [item.permission]: state.value })
                          }}
                        />
                        {state.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )
            })}
          </div>
        )}
      />

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {editable && (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={formState.isSubmitting || !formState.isDirty}>
            Сохранить права
          </Button>
          <p role="status" className="text-sm text-fg-muted">
            {saved && !formState.isDirty ? 'Сохранено' : null}
          </p>
        </div>
      )}
    </form>
  )
}
