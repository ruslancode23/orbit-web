import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { useCreateWorkspace } from '@/entities/workspace'
import { isApiError } from '@/shared/api'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

interface WorkspaceValues {
  name: string
}

/** Creates a server and opens it. The creator becomes its owner. */
export const CreateWorkspace = () => {
  const nameId = useId()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const create = useCreateWorkspace()
  const { register, handleSubmit, reset, formState } = useForm<WorkspaceValues>({
    defaultValues: { name: '' },
  })

  const submit = handleSubmit(async (values) => {
    const membership = await create
      .mutateAsync({ body: { name: values.name.trim() } })
      .catch(() => null)
    if (!membership) {
      return
    }
    reset()
    setOpen(false)
    await navigate(`/s/${membership.workspace.id}`)
  })

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Создать сервер"
        title="Создать сервер"
        onClick={() => {
          setOpen(true)
        }}
      >
        +
      </Button>
    )
  }

  return (
    <form
      className="flex w-48 flex-col gap-2 rounded-md bg-surface p-2"
      onSubmit={(event) => {
        void submit(event)
      }}
    >
      <Label htmlFor={nameId}>Название сервера</Label>
      <Input
        id={nameId}
        maxLength={64}
        aria-invalid={formState.errors.name ? true : undefined}
        {...register('name', { required: true, validate: (value) => value.trim().length > 0 })}
      />
      {create.error && (
        <p role="alert" className="text-sm text-danger">
          {describeError(create.error)}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={create.isPending}>
          Создать
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false)
          }}
        >
          Отмена
        </Button>
      </div>
    </form>
  )
}

const describeError = (error: unknown): string => {
  if (isApiError(error) && error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  return 'Не получилось создать сервер.'
}
