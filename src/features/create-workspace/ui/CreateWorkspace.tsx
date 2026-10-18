import { useId, useState } from 'react'
import { useNavigate } from 'react-router'

import { useCreateWorkspace } from '@/entities/workspace'
import { isApiError } from '@/shared/api'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

/** Creates a server and opens it. The creator becomes its owner. */
export function CreateWorkspace() {
  const nameId = useId()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const navigate = useNavigate()
  const create = useCreateWorkspace()

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed || create.isPending) return
    const membership = await create.mutateAsync({ body: { name: trimmed } }).catch(() => null)
    if (!membership) return
    setName('')
    setOpen(false)
    await navigate(`/s/${membership.workspace.id}`)
  }

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
        event.preventDefault()
        void submit()
      }}
    >
      <Label htmlFor={nameId}>Название сервера</Label>
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
  if (isApiError(error) && error.isNetworkError) return 'Нет соединения с сервером.'
  return 'Не получилось создать сервер.'
}
