import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { applyUserProfile } from '@/entities/live'
import {
  clearMyStatusMutation,
  isApiError,
  setMyStatusMutation,
  updateMyProfileMutation,
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
import { XIcon } from '@/shared/ui/icon'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'

import { statusIsAlive } from '../model/profile'

type StatusExpiry = NonNullable<StatusUpdate['expiresIn']>

interface EditProfileValues {
  displayName: string
  bio: string
  statusEmoji: string
  statusText: string
  statusExpiry: StatusExpiry
}

interface EditProfileDialogProps {
  profile: UserProfile
  onClose: () => void
}

const EXPIRY_OPTIONS: { value: StatusExpiry; label: string }[] = [
  { value: 'never', label: 'Бессрочно' },
  { value: '30m', label: '30 минут' },
  { value: '4h', label: '4 часа' },
  { value: 'end_of_day', label: 'До конца дня' },
]

/**
 * «Редактировать профиль»: the public fields the profile endpoint owns and the
 * custom status with its server-measured deadline. The nickname is not here —
 * it identifies the account and has its own endpoint with a password.
 */
export const EditProfileDialog = ({ profile, onClose }: EditProfileDialogProps) => {
  const queryClient = useQueryClient()
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const updateProfile = useMutation(updateMyProfileMutation())
  const setStatus = useMutation(setMyStatusMutation())
  const clearStatus = useMutation(clearMyStatusMutation())

  const aliveStatus =
    profile.customStatus && statusIsAlive(profile.customStatus) ? profile.customStatus : undefined
  const initial = {
    displayName: profile.displayName,
    bio: profile.bio,
    statusEmoji: aliveStatus?.emoji ?? '',
    statusText: aliveStatus?.text ?? '',
    statusExpiry: 'never' as StatusExpiry,
  }
  const { register, handleSubmit, formState } = useForm<EditProfileValues>({
    defaultValues: initial,
  })

  const pending = updateProfile.isPending || setStatus.isPending || clearStatus.isPending

  const submit = handleSubmit(async (values) => {
    setFailure(undefined)
    try {
      const updated = await updateProfile.mutateAsync({
        body: {
          displayName: values.displayName.trim(),
          bio: values.bio.trim(),
        },
      })
      applyUserProfile(queryClient, updated)

      const emoji = values.statusEmoji.trim()
      const text = values.statusText.trim()
      const changed = emoji !== initial.statusEmoji || text !== initial.statusText
      if (changed) {
        const saved =
          emoji === '' && text === ''
            ? await clearStatus.mutateAsync({})
            : await setStatus.mutateAsync({
                body: {
                  ...(emoji === '' ? {} : { emoji }),
                  ...(text === '' ? {} : { text }),
                  expiresIn: values.statusExpiry,
                },
              })
        applyUserProfile(queryClient, saved)
      }
      onClose()
    } catch (error) {
      setFailure(
        isApiError(error) && error.message !== ''
          ? error.message
          : 'Не удалось сохранить профиль. Попробуйте ещё раз.',
      )
    }
  })

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
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle>Редактировать профиль</DialogTitle>
            <DialogDescription>
              Имя, о себе и статус видят все, кто открывает вашу карточку.
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

        <form className="flex flex-col gap-4" noValidate onSubmit={(event) => void submit(event)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-display-name">Имя</Label>
            <Input
              id="profile-display-name"
              maxLength={32}
              aria-invalid={formState.errors.displayName !== undefined}
              {...register('displayName', {
                maxLength: { value: 32, message: 'Не больше 32 символов.' },
              })}
            />
            <p className="text-xs text-fg-muted">
              Пустое имя — показываем ник @{profile.nickname}.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-bio">О себе</Label>
            <Textarea
              id="profile-bio"
              maxLength={190}
              rows={3}
              aria-invalid={formState.errors.bio !== undefined}
              {...register('bio', {
                maxLength: { value: 190, message: 'Не больше 190 символов.' },
              })}
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Статус</legend>
            <div className="flex gap-2">
              <div className="w-16 shrink-0">
                <Label htmlFor="profile-status-emoji" className="sr-only">
                  Эмодзи статуса
                </Label>
                <Input
                  id="profile-status-emoji"
                  maxLength={32}
                  aria-label="Эмодзи статуса"
                  placeholder="🙂"
                  {...register('statusEmoji')}
                />
              </div>
              <div className="min-w-0 flex-1">
                <Label htmlFor="profile-status-text" className="sr-only">
                  Текст статуса
                </Label>
                <Input
                  id="profile-status-text"
                  maxLength={128}
                  aria-label="Текст статуса"
                  placeholder="Чем занимаетесь"
                  {...register('statusText')}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-status-expiry">Срок статуса</Label>
              <select
                id="profile-status-expiry"
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                {...register('statusExpiry')}
              >
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-fg-muted">
                Очистите оба поля, чтобы убрать статус. Срок применяется, когда текст или эмодзи
                меняются.
              </p>
            </div>
          </fieldset>

          {failure !== undefined && (
            <p role="alert" className="text-sm text-danger">
              {failure}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Отмена
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
