import { useId } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'

import { accentOf } from '@/shared/lib/accent'
import { cn } from '@/shared/lib/cn'
import { characterCount } from '@/shared/lib/text'
import { Input } from '@/shared/ui/input'

import { ROLE_NAME_MAX, STARTER_ROLES, type StarterRole } from '../config/starter-roles'

import type { CreateWorkspaceValues } from '../model/useCreateWorkspaceFlow'

/**
 * The roles a new server starts with: each may be left out or renamed. The
 * names are checked here, by the server's rules, before anything is sent.
 */
export const StarterRolesFields = () => {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-semibold text-fg">Стартовые роли</legend>
      <p className="text-sm text-fg-muted">
        Роли можно выдать людям из их карточки и поменять потом в настройках сервера.
      </p>
      {STARTER_ROLES.map((role) => (
        <StarterRoleRow key={role.id} role={role} />
      ))}
    </fieldset>
  )
}

const StarterRoleRow = ({ role }: { role: StarterRole }) => {
  const toggleId = useId()
  const nameId = useId()
  const errorId = useId()
  const {
    register,
    control,
    getValues,
    formState: { errors },
  } = useFormContext<CreateWorkspaceValues>()
  const enabled = useWatch({ control, name: `roles.${role.id}.enabled` })
  const error = errors.roles?.[role.id]?.name?.message

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-start gap-3">
        <input
          id={toggleId}
          type="checkbox"
          className="mt-1 accent-accent"
          {...register(`roles.${role.id}.enabled`, {
            // Leaving a role out may settle the other one's duplicate name.
            deps: ['roles.admin.name', 'roles.moderator.name'],
          })}
        />
        <label htmlFor={toggleId} className="flex flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-sm font-medium text-fg">
            <span
              aria-hidden="true"
              className={cn('size-2.5 rounded-full', accentOf(role.color)?.swatch)}
            />
            Создать роль «{role.name}»
          </span>
          <span className="text-xs text-fg-muted">{role.hint}</span>
        </label>
      </div>
      {enabled && (
        <div className="flex flex-col gap-1 pl-7">
          <label htmlFor={nameId} className="text-xs text-fg-muted">
            Название роли
          </label>
          <Input
            id={nameId}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            {...register(`roles.${role.id}.name`, {
              validate: (value) => {
                if (!getValues(`roles.${role.id}.enabled`)) {
                  return true
                }
                const name = value.trim()
                const length = characterCount(name)
                if (length === 0) {
                  return 'Введите название роли.'
                }
                if (length > ROLE_NAME_MAX) {
                  return `Название роли — не больше ${String(ROLE_NAME_MAX)} символов.`
                }
                if (name.toLowerCase() === '@everyone') {
                  return 'Это название занято ролью всех участников.'
                }
                const twin = STARTER_ROLES.find(
                  (other) =>
                    other.id !== role.id &&
                    getValues(`roles.${other.id}.enabled`) &&
                    getValues(`roles.${other.id}.name`).trim().toLowerCase() === name.toLowerCase(),
                )
                return twin === undefined || 'У двух ролей одинаковые названия.'
              },
            })}
          />
          {error && (
            <p id={errorId} role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
