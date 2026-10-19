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
}

/** Creates a channel in this server and opens it. Admins and the owner only. */
export const CreateChannel = ({ workspaceId }: CreateChannelProps) => {
  const nameId = useId()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const create = useCreateChannel(workspaceId)
  const { register, handleSubmit, reset, formState } = useForm<ChannelValues>({
    defaultValues: { name: '' },
  })

  const submit = handleSubmit(async (values) => {
    const channel = await create
      .mutateAsync({ path: { workspaceId }, body: { name: values.name.trim() } })
      .catch(() => null)
    if (!channel) return
    reset()
    setOpen(false)
    await navigate(`/s/${workspaceId}/${channel.id}`)
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
  if (!isApiError(error)) return 'Не получилось создать канал.'
  if (error.isNetworkError) return 'Нет соединения с сервером.'
  if (error.status === 409) return 'Канал с таким названием уже есть.'
  if (error.status === 403) return 'Для этого нужны права администратора.'
  return 'Не получилось создать канал.'
}
