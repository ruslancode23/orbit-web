import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { applyUserProfile } from '@/entities/live'
import {
  clearMyStatusMutation,
  isApiError,
  setMyStatusMutation,
  type StatusUpdate,
  type UserProfile,
} from '@/shared/api'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useToast } from '@/shared/ui/toast'

import { statusIsAlive } from '../model/profile'

type StatusExpiry = NonNullable<StatusUpdate['expiresIn']>

const EXPIRY_OPTIONS: { value: StatusExpiry; label: string }[] = [
  { value: '30m', label: '30 минут' },
  { value: '4h', label: '4 часа' },
  { value: 'end_of_day', label: 'До конца дня' },
  { value: 'never', label: 'Не сбрасывать' },
]

/** The emoji a person is most likely to want; the input takes any other. */
const EMOJI_CHOICES = [
  '😀',
  '😎',
  '🤔',
  '🔥',
  '🚀',
  '❤️',
  '🎉',
  '☕',
  '🌙',
  '💤',
  '🎧',
  '🍀',
] as const

interface StatusValues {
  emoji: string
  text: string
  expiry: StatusExpiry
}

interface SetStatusDialogProps {
  profile: UserProfile
  onClose: () => void
}

/**
 * The custom status: a short line next to the name, an emoji and a deadline
 * the server measures. «Очистить подпись» removes it; saving without either
 * field is refused here instead of being sent as an empty status.
 */
export const SetStatusDialog = ({ profile, onClose }: SetStatusDialogProps) => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const emojiId = useId()
  const textId = useId()
  const expiryId = useId()
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const setStatus = useMutation(setMyStatusMutation())
  const clearStatus = useMutation(clearMyStatusMutation())

  const alive = profile.customStatus && statusIsAlive(profile.customStatus)
  const { register, handleSubmit, formState, setValue, setError, control } = useForm<StatusValues>({
    defaultValues: {
      emoji: alive ? (profile.customStatus?.emoji ?? '') : '',
      text: alive ? (profile.customStatus?.text ?? '') : '',
      expiry: 'never',
    },
  })
  const emoji = useWatch({ control, name: 'emoji' })
  const pending = setStatus.isPending || clearStatus.isPending

  const submit = handleSubmit(async (values) => {
    setFailure(undefined)
    const nextEmoji = values.emoji.trim()
    const nextText = values.text.trim()
    if (nextEmoji === '' && nextText === '') {
      setError('root', { message: 'Добавьте эмодзи или текст — или очистите подпись.' })
      return
    }
    try {
      const saved = await setStatus.mutateAsync({
        body: {
          ...(nextEmoji === '' ? {} : { emoji: nextEmoji }),
          ...(nextText === '' ? {} : { text: nextText }),
          expiresIn: values.expiry,
        },
      })
      applyUserProfile(queryClient, saved)
      toast('Подпись обновлена', 'success')
      onClose()
    } catch (error) {
      setFailure(
        isApiError(error) && error.message !== ''
          ? error.message
          : 'Не получилось обновить подпись. Попробуйте ещё раз.',
      )
    }
  })

  const clear = async () => {
    setFailure(undefined)
    try {
      const saved = await clearStatus.mutateAsync({})
      applyUserProfile(queryClient, saved)
      toast('Подпись очищена', 'success')
      onClose()
    } catch (error) {
      setFailure(
        isApiError(error) && error.message !== ''
          ? error.message
          : 'Не получилось очистить подпись. Попробуйте ещё раз.',
      )
    }
  }

  const rootError = formState.errors.root?.message

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <div className="flex flex-col gap-1">
          <DialogTitle>Подпись к статусу</DialogTitle>
          <DialogDescription>
            Короткая строка рядом с именем. Срок считает сервер, поэтому он не зависит от часов на
            устройстве.
          </DialogDescription>
        </div>

        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            void submit(event)
          }}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Эмодзи</legend>
            <div className="flex flex-wrap gap-1">
              {EMOJI_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  aria-pressed={emoji === choice}
                  className="flex size-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none aria-pressed:bg-surface-hover aria-pressed:ring-1 aria-pressed:ring-accent"
                  onClick={() => {
                    setValue('emoji', emoji === choice ? '' : choice, { shouldDirty: true })
                  }}
                >
                  {choice}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={emojiId}>Свой эмодзи</Label>
              <Input id={emojiId} maxLength={32} placeholder="🙂" {...register('emoji')} />
            </div>
          </fieldset>

          <div className="flex flex-col gap-1">
            <Label htmlFor={textId}>Текст подписи</Label>
            <Input
              id={textId}
              maxLength={128}
              placeholder="Чем занимаетесь"
              {...register('text')}
            />
            <p className="text-xs text-fg-muted">До 128 символов.</p>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor={expiryId}>Срок</Label>
            <select
              id={expiryId}
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              {...register('expiry')}
            >
              {EXPIRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {(failure !== undefined || rootError !== undefined) && (
            <p role="alert" className="text-sm text-danger">
              {failure ?? rootError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            {alive ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => void clear()}
              >
                Очистить подпись
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Отмена
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending} aria-busy={pending}>
                {pending ? 'Сохраняем…' : 'Сохранить'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
