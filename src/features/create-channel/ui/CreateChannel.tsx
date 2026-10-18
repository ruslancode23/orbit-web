import { useId, useState } from 'react'
import { useNavigate } from 'react-router'

import { useCreateChannel } from '@/entities/channel'
import { isApiError } from '@/shared/api'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

interface CreateChannelProps {
  workspaceId: string
}

/** Creates a channel in this server and opens it. Admins and the owner only. */
export function CreateChannel({ workspaceId }: CreateChannelProps) {
  const nameId = useId()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const navigate = useNavigate()
  const create = useCreateChannel(workspaceId)

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed || create.isPending) return
    const channel = await create
      .mutateAsync({ path: { workspaceId }, body: { name: trimmed } })
      .catch(() => null)
    if (!channel) return
    setName('')
    setOpen(false)
    await navigate(`/s/${workspaceId}/${channel.id}`)
  }

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
        event.preventDefault()
        void submit()
      }}
    >
      <Label htmlFor={nameId}>Название канала</Label>
      <Input
        id={nameId}
        value={name}
        maxLength={64}
        onChange={(event) => {
          setName(event.target.value)
        }}
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

function describeError(error: unknown): string {
  if (!isApiError(error)) return 'Не получилось создать канал.'
  if (error.isNetworkError) return 'Нет соединения с сервером.'
  if (error.status === 409) return 'Канал с таким названием уже есть.'
  if (error.status === 403) return 'Для этого нужны права администратора.'
  return 'Не получилось создать канал.'
}
