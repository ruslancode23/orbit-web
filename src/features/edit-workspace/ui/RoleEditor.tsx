import { useId, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'

import {
  describeRoleError,
  PERMISSION_GROUPS,
  useRoleEditing,
  type Permission,
  type Role,
} from '@/entities/workspace'
import type { RoleUpdateRequest } from '@/shared/api'
import { ACCENTS, accentOf, type Accent } from '@/shared/lib/accent'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'

interface RoleEditorProps {
  workspaceId: string
  role: Role
  /** Whether the reader may change this role at all. */
  editable: boolean
  /** Whether the reader holds a permission: nobody hands out what they lack. */
  grantable: (permission: Permission) => boolean
  onDeleted: () => void
}

interface RoleValues {
  name: string
  color: Accent | ''
  hoist: boolean
  permissions: Permission[]
}

const valuesOf = (role: Role): RoleValues => ({
  name: role.name,
  color: accentOf(role.color)?.value ?? '',
  hoist: role.hoist,
  permissions: [...role.permissions],
})

const sameSet = (a: readonly Permission[], b: readonly Permission[]) =>
  a.length === b.length && a.every((permission) => b.includes(permission))

/**
 * One role: its name, colour, whether it is shown as its own group, and what it
 * grants. Only what changed is sent. A permission the reader lacks can be taken
 * away but not given; @everyone keeps its name and look and changes its
 * permissions only.
 */
export const RoleEditor = ({
  workspaceId,
  role,
  editable,
  grantable,
  onDeleted,
}: RoleEditorProps) => {
  const nameId = useId()
  const hoistId = useId()
  const editing = useRoleEditing(workspaceId)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const { register, control, handleSubmit, reset, setValue, formState } = useForm<RoleValues>({
    values: valuesOf(role),
    resetOptions: { keepDirtyValues: true },
  })
  const color = useWatch({ control, name: 'color' })
  const looksLocked = role.isDefault || !editable

  const submit = handleSubmit(async (values) => {
    setError(null)
    setSaved(false)
    const body: RoleUpdateRequest = {}
    if (!role.isDefault && values.name.trim() !== role.name) {
      body.name = values.name.trim()
    }
    if (!role.isDefault && values.color !== (role.color ?? '')) {
      if (values.color === '') {
        body.clearColor = true
      } else {
        body.color = values.color
      }
    }
    if (!role.isDefault && values.hoist !== role.hoist) {
      body.hoist = values.hoist
    }
    if (!sameSet(values.permissions, role.permissions)) {
      body.permissions = values.permissions
    }
    if (Object.keys(body).length === 0) {
      return
    }
    try {
      await editing.update.mutateAsync({ path: { roleId: role.id }, body })
    } catch (failure) {
      setError(describeRoleError(failure))
      return
    }
    reset(values)
    setSaved(true)
  })

  const remove = () => {
    setError(null)
    editing.remove.mutate(
      { path: { roleId: role.id } },
      {
        onSuccess: onDeleted,
        onError: (failure) => {
          setError(describeRoleError(failure))
          setConfirming(false)
        },
      },
    )
  }

  return (
    <form
      aria-label={`Роль ${role.name}`}
      className="flex flex-col gap-4 rounded-lg border border-border p-4"
      onSubmit={(event) => {
        void submit(event)
      }}
    >
      <h3 className="text-base font-semibold">
        {role.isDefault ? '@everyone — права всех участников' : role.name}
      </h3>
      {!editable && (
        <p className="text-sm text-fg-muted">Эта роль не ниже вашей: её можно только посмотреть.</p>
      )}

      {!role.isDefault && (
        <>
          <div className="flex flex-col gap-1">
            <Label htmlFor={nameId}>Название</Label>
            <Input
              id={nameId}
              maxLength={32}
              disabled={looksLocked}
              {...register('name', { required: true })}
            />
          </div>

          <fieldset className="flex flex-col gap-2" disabled={looksLocked}>
            <legend className="text-sm font-medium text-fg">Цвет</legend>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-label="Без цвета"
                aria-pressed={color === ''}
                className={cn(
                  'size-7 rounded-full border border-border bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
                  color === '' && 'ring-2 ring-fg ring-offset-2 ring-offset-surface',
                )}
                onClick={() => {
                  setValue('color', '', { shouldDirty: true })
                }}
              />
              {ACCENTS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-label={option.label}
                  aria-pressed={color === option.value}
                  className={cn(
                    'size-7 rounded-full focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
                    option.swatch,
                    color === option.value && 'ring-2 ring-fg ring-offset-2 ring-offset-surface',
                  )}
                  onClick={() => {
                    setValue('color', option.value, { shouldDirty: true })
                  }}
                />
              ))}
            </div>
          </fieldset>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor={hoistId}>Показывать участников отдельно</Label>
            <Controller
              control={control}
              name="hoist"
              render={({ field }) => (
                <Switch
                  id={hoistId}
                  checked={field.value}
                  disabled={looksLocked}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        </>
      )}

      <Controller
        control={control}
        name="permissions"
        render={({ field }) => (
          <>
            {PERMISSION_GROUPS.map((group) => (
              <fieldset key={group.title} className="flex flex-col gap-3">
                <legend className="text-sm font-semibold text-fg">{group.title}</legend>
                {group.items.map((item) => {
                  const on = field.value.includes(item.permission)
                  // What the reader lacks may be taken away, never given.
                  const locked = !editable || (!on && !grantable(item.permission))
                  return (
                    <div key={item.permission} className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-col">
                        <span className="text-sm text-fg">{item.title}</span>
                        <span className="text-xs text-fg-muted">{item.hint}</span>
                      </div>
                      <Switch
                        aria-label={item.title}
                        checked={on}
                        disabled={locked}
                        onCheckedChange={(checked) => {
                          field.onChange(
                            checked
                              ? [...field.value, item.permission]
                              : field.value.filter((permission) => permission !== item.permission),
                          )
                        }}
                      />
                    </div>
                  )
                })}
              </fieldset>
            ))}
          </>
        )}
      />

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={formState.isSubmitting || !formState.isDirty}>
            Сохранить роль
          </Button>
          <p role="status" className="text-sm text-fg-muted">
            {formState.isSubmitting
              ? 'Сохраняем…'
              : saved && !formState.isDirty
                ? 'Сохранено'
                : null}
          </p>
          {!role.isDefault &&
            (confirming ? (
              <span className="ml-auto flex items-center gap-2">
                <span className="text-sm text-fg">Удалить роль у всех?</span>
                <Button type="button" variant="danger" size="sm" onClick={remove}>
                  Удалить
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setConfirming(false)
                  }}
                >
                  Отмена
                </Button>
              </span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="ml-auto"
                onClick={() => {
                  setConfirming(true)
                }}
              >
                Удалить роль
              </Button>
            ))}
        </div>
      )}
    </form>
  )
}
