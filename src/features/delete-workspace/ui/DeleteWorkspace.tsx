import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { useDeleteWorkspace, type Workspace } from '@/entities/workspace'
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

interface DeleteWorkspaceProps {
  workspace: Workspace
}

interface ConfirmValues {
  name: string
}

/**
 * Deletes a server with everything in it. The owner only, and only after
 * typing its name: there is no way back. Then home, since the server is gone.
 */
export const DeleteWorkspace = ({ workspace }: DeleteWorkspaceProps) => {
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const remove = useDeleteWorkspace()
  const { register, handleSubmit, reset, control } = useForm<ConfirmValues>({
    defaultValues: { name: '' },
  })
  const typed = useWatch({ control, name: 'name' })
  const confirmed = typed.trim() === workspace.name

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (!next) {
      reset()
      remove.reset()
    }
  }

  const submit = handleSubmit(async () => {
    const done = await remove
      .mutateAsync({ path: { workspaceId: workspace.id } })
      .then(() => true)
      .catch(() => false)
    if (!done) return
    setOpen(false)
    await navigate('/', { replace: true })
  })

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="danger">Удалить сервер</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Удалить сервер «{workspace.name}»?</DialogTitle>
        <DialogDescription>
          Удалятся все каналы, сообщения и файлы, участники потеряют доступ. Отменить это нельзя.
        </DialogDescription>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            void submit(event)
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={inputId}>Введите название сервера, чтобы подтвердить</Label>
            <Input
              id={inputId}
              autoComplete="off"
              {...register('name', { validate: (value) => value.trim() === workspace.name })}
            />
          </div>
          {remove.error && (
            <p role="alert" className="text-sm text-danger">
              {describeError(remove.error)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Отмена
              </Button>
            </DialogClose>
            <Button type="submit" variant="danger" disabled={!confirmed || remove.isPending}>
              Удалить навсегда
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const describeError = (error: unknown): string => {
  if (isApiError(error) && error.isNetworkError) return 'Нет соединения с сервером.'
  if (isApiError(error) && error.status === 403) return 'Удалить сервер может только владелец.'
  return 'Не получилось удалить сервер.'
}
