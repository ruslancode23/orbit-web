import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { useCreateChannel } from '@/entities/channel'
import { isApiError } from '@/shared/api'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'
import { XIcon } from '@/shared/ui/icon'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

interface CreateChannelProps {
  workspaceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ChannelValues {
  name: string
  kind: 'text' | 'voice'
}

/** Creates a channel in this server and opens it. Admins and the owner only. */
export const CreateChannel = ({ workspaceId, open, onOpenChange }: CreateChannelProps) => {
  const nameId = useId()
  const kindId = useId()
  const navigate = useNavigate()
  const create = useCreateChannel(workspaceId)
  const { register, handleSubmit, reset, formState } = useForm<ChannelValues>({
    defaultValues: { name: '', kind: 'text' },
  })

  const submit = handleSubmit(async (values) => {
    const channel = await create
      .mutateAsync({
        path: { workspaceId },
        body: { name: values.name.trim(), kind: values.kind },
      })
      .catch(() => null)
    if (!channel) {
      return
    }
    reset()
    onOpenChange(false)
    // A voice channel has no page of its own: a click in the sidebar joins it.
    if (channel.kind === 'text') {
      await navigate(`/s/${workspaceId}/${channel.id}`)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle>Создать канал</DialogTitle>
            <DialogDescription>
              Текстовый канал для сообщений или голосовой для разговоров.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <button
              type="button"
              aria-label="Закрыть"
              title="Закрыть"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <XIcon />
            </button>
          </DialogClose>
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            void submit(event)
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor={kindId}>Тип канала</Label>
            <select
              id={kindId}
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              {...register('kind')}
            >
              <option value="text">Текстовый</option>
              <option value="voice">Голосовой</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={nameId}>Название канала</Label>
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
  if (!isApiError(error)) {
    return 'Не получилось создать канал.'
  }
  if (error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  if (error.status === 409) {
    return 'Канал с таким названием уже есть.'
  }
  if (error.status === 403) {
    return 'Для этого нужны права администратора.'
  }
  return 'Не получилось создать канал.'
}
