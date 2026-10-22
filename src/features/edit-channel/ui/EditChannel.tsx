import { useId, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { useDeleteChannel, useUpdateChannel, type Channel } from '@/entities/channel'
import { isApiError, type ChannelUpdateRequest } from '@/shared/api'
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
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

import { ChannelOverrides } from './ChannelOverrides'

interface EditChannelProps {
  workspaceId: string
  channel: Channel
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ChannelValues {
  name: string
  topic: string
  isReadOnly: boolean
}

/**
 * Renaming a channel, setting its topic and making it read-only, and on the
 * «Права» tab what each role may do here. Only what changed is sent; deleting asks for a second press and drops the reader back
 * to the server, since the channel they were reading is gone.
 */
export const EditChannel = ({ workspaceId, channel, open, onOpenChange }: EditChannelProps) => {
  const nameId = useId()
  const topicId = useId()
  const readOnlyId = useId()
  const [confirming, setConfirming] = useState(false)
  const navigate = useNavigate()
  const update = useUpdateChannel(workspaceId)
  const remove = useDeleteChannel(workspaceId)
  const { register, handleSubmit, control, formState } = useForm<ChannelValues>({
    defaultValues: {
      name: channel.name,
      topic: channel.topic ?? '',
      isReadOnly: channel.isReadOnly,
    },
  })

  const submit = handleSubmit(async (next) => {
    const body: ChannelUpdateRequest = {}
    if (next.name.trim() !== channel.name && next.name.trim() !== '') {
      body.name = next.name.trim()
    }
    if (next.topic.trim() !== (channel.topic ?? '')) {
      body.topic = next.topic.trim()
    }
    if (next.isReadOnly !== channel.isReadOnly) {
      body.isReadOnly = next.isReadOnly
    }
    if (Object.keys(body).length === 0) {
      onOpenChange(false)
      return
    }
    const updated = await update
      .mutateAsync({ path: { channelId: channel.id }, body })
      .catch(() => null)
    if (updated) {
      onOpenChange(false)
    }
  })

  const deleteChannel = async () => {
    const deleted = await remove
      .mutateAsync({ path: { channelId: channel.id } })
      .then(() => true)
      .catch(() => false)
    if (!deleted) {
      return
    }
    onOpenChange(false)
    await navigate(`/s/${workspaceId}`)
  }

  const error = update.error ?? remove.error

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle>Настройки канала</DialogTitle>
            <DialogDescription>Название, тема и права ролей в этом канале.</DialogDescription>
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

        <Tabs defaultValue="general" className="flex flex-col gap-3">
          <TabsList aria-label="Разделы настроек канала">
            <TabsTrigger value="general">Общее</TabsTrigger>
            <TabsTrigger value="permissions">Права</TabsTrigger>
          </TabsList>
          <TabsContent value="permissions">
            <ChannelOverrides workspaceId={workspaceId} channel={channel} />
          </TabsContent>
          <TabsContent value="general">
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                void submit(event)
              }}
            >
              <div className="flex flex-col gap-1">
                <Label htmlFor={nameId}>Название канала</Label>
                <Input
                  id={nameId}
                  maxLength={64}
                  aria-invalid={formState.errors.name ? true : undefined}
                  {...register('name', {
                    validate: (value) =>
                      value.trim().length > 0 || 'Название не может быть пустым.',
                  })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={topicId}>Тема</Label>
                <Input
                  id={topicId}
                  maxLength={500}
                  placeholder="О чём этот канал"
                  {...register('topic')}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor={readOnlyId}>Пишут только администраторы</Label>
                <Controller
                  control={control}
                  name="isReadOnly"
                  render={({ field }) => (
                    <Switch
                      id={readOnlyId}
                      ref={field.ref}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-danger">
                  {describeError(error)}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                {!confirming ? (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => {
                      setConfirming(true)
                    }}
                  >
                    Удалить канал
                  </Button>
                ) : (
                  <div
                    role="group"
                    aria-label="Подтверждение удаления канала"
                    className="flex flex-wrap items-center gap-1"
                  >
                    <span className="text-xs text-fg-muted">Удалить канал навсегда?</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      disabled={remove.isPending}
                      onClick={() => {
                        void deleteChannel()
                      }}
                    >
                      Удалить
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setConfirming(false)
                      }}
                    >
                      Отмена
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <DialogClose asChild>
                    <Button type="button" variant="ghost">
                      Закрыть
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={update.isPending}>
                    Сохранить
                  </Button>
                </div>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

const describeError = (error: unknown): string => {
  if (!isApiError(error)) {
    return 'Не получилось сохранить канал.'
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
  return 'Не получилось сохранить канал.'
}
