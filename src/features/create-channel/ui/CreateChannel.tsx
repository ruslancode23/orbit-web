import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { useCreateChannel } from '@/entities/channel'
import { isApiError } from '@/shared/api'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

interface CreateChannelProps {
  workspaceId: string
}

interface ChannelValues {
  name: string
  kind: 'text' | 'voice'
}

/** Creates a channel in this server and opens it. Admins and the owner only. */
export const CreateChannel = ({ workspaceId }: CreateChannelProps) => {
  const nameId = useId()
  const kindId = useId()
  const [open, setOpen] = useState(false)
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
    setOpen(false)
    // A voice channel has no page of its own: a click in the sidebar joins it.
    if (channel.kind === 'text') {
      await navigate(`/s/${workspaceId}/${channel.id}`)
    }
  })

  if (!open) {
    return (
      <Button
        variant="ghost"
        onClick={() => {
          setOpen(true)
        }}
      >
        + Канал
      </Button>
    )
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        void submit(event)
      }}
    >
      <Label htmlFor={kindId}>Тип канала</Label>
      <select
        id={kindId}
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        {...register('kind')}
      >
        <option value="text">Текстовый</option>
        <option value="voice">Голосовой</option>
      </select>
      <Label htmlFor={nameId}>Название канала</Label>
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
