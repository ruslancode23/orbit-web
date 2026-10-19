import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { useCreateWorkspace } from '@/entities/workspace'
import { isApiError } from '@/shared/api'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog'
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

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (!next) {
      reset()
      create.reset()
    }
  }

  const submit = handleSubmit(async (values) => {
    const membership = await create
      .mutateAsync({ body: { name: values.name.trim() } })
      .catch(() => null)
    if (!membership) return
    changeOpen(false)
    await navigate(`/s/${membership.workspace.id}`)
  })

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Создать сервер" title="Создать сервер">
          +
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Создать сервер</DialogTitle>
        <DialogDescription>Вы станете его владельцем.</DialogDescription>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            void submit(event)
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={nameId}>Название сервера</Label>
            <Input
              id={nameId}
              maxLength={64}
              aria-invalid={formState.errors.name ? true : undefined}
              {...register('name', {
                required: true,
                validate: (value) => value.trim().length > 0,
              })}
            />
          </div>
          {create.error && (
            <p role="alert" className="text-sm text-danger">
              {describeError(create.error)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Отмена
              </Button>
            </DialogClose>
            <Button type="submit" disabled={create.isPending}>
              Создать
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const describeError = (error: unknown): string => {
  if (isApiError(error) && error.isNetworkError) return 'Нет соединения с сервером.'
  return 'Не получилось создать сервер.'
}
