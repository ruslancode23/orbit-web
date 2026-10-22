import { useId } from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'

import { characterCount } from '@/shared/lib/text'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'

import { WorkspaceIconField } from './WorkspaceIconField'
import { DESCRIPTION_MAX, NAME_MAX, type WorkspaceProfileValues } from '../model/form'

interface WorkspaceProfileFieldsProps {
  /** The icon the server has now; none while it is being created. */
  currentIconUrl?: string | null
  colorKey?: string
}

/**
 * Name, description and avatar of a server, for any form that holds
 * `WorkspaceProfileValues` (`FormProvider` around it): creating a server and
 * its settings fill the same fields. A refusal of the server is put on the
 * field with `setError`.
 */
export const WorkspaceProfileFields = ({
  currentIconUrl,
  colorKey,
}: WorkspaceProfileFieldsProps) => {
  const nameId = useId()
  const nameErrorId = useId()
  const descriptionId = useId()
  const descriptionHintId = useId()
  const {
    register,
    control,
    clearErrors,
    formState: { errors },
  } = useFormContext<WorkspaceProfileValues>()
  const name = useWatch({ control, name: 'name' })
  const description = useWatch({ control, name: 'description' })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={nameId}>Название сервера</Label>
        <Input
          id={nameId}
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? nameErrorId : undefined}
          {...register('name', {
            // The server counts characters, not UTF-16 units: emoji count once.
            validate: (value) => {
              const length = characterCount(value.trim())
              if (length === 0) {
                return 'Введите название сервера.'
              }
              return length <= NAME_MAX || `Название — не больше ${String(NAME_MAX)} символов.`
            },
          })}
        />
        {errors.name?.message && (
          <p id={nameErrorId} role="alert" className="text-sm text-danger">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={descriptionId}>
          Описание <span className="font-normal text-fg-muted">(необязательно)</span>
        </Label>
        <Textarea
          id={descriptionId}
          placeholder="О чём этот сервер"
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={descriptionHintId}
          {...register('description', {
            validate: (value) =>
              characterCount(value.trim()) <= DESCRIPTION_MAX ||
              `Описание — не больше ${String(DESCRIPTION_MAX)} символов.`,
          })}
        />
        <p id={descriptionHintId} className="flex justify-between gap-2 text-xs text-fg-muted">
          <span role={errors.description ? 'alert' : undefined} className="text-danger">
            {errors.description?.message}
          </span>
          <span>
            {characterCount(description)} / {DESCRIPTION_MAX}
          </span>
        </p>
      </div>

      <Controller
        control={control}
        name="icon"
        render={({ field }) => (
          <WorkspaceIconField
            value={field.value}
            onChange={(value) => {
              clearErrors('icon')
              field.onChange(value)
            }}
            name={name}
            currentIconUrl={currentIconUrl}
            colorKey={colorKey}
            error={errors.icon?.message}
          />
        )}
      />
    </div>
  )
}
