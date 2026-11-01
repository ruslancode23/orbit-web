import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { useForgetSession } from '@/entities/session'
import { deleteCurrentUserMutation, isApiError, type SelfProfile } from '@/shared/api'
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
import { useToast } from '@/shared/ui/toast'

interface DeleteAccountProps {
  profile: SelfProfile
}

interface DeleteAccountValues {
  password: string
  confirmation: boolean
}

interface DeleteErrorText {
  field?: 'password'
  message: string
}

/**
 * «Опасно»: удаление самого аккаунта. Аккаунт с паролем подтверждает его;
 * у гостя пароля нет, и он подтверждает галочкой — сессия и есть его
 * единственный ключ. Личные данные удаляются, а сообщения в общих каналах
 * остаются за «удалённым».
 */
export const DeleteAccount = ({ profile }: DeleteAccountProps) => {
  const [open, setOpen] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()
  const forgetSession = useForgetSession()
  const passwordId = useId()
  const confirmationId = useId()
  const titleId = useId()
  const { register, handleSubmit, formState, reset, control, setError, clearErrors } =
    useForm<DeleteAccountValues>({
      defaultValues: { password: '', confirmation: false },
    })
  const password = useWatch({ control, name: 'password' })
  const confirmation = useWatch({ control, name: 'confirmation' })
  const deleteAccount = useMutation({
    ...deleteCurrentUserMutation(),
    // Неверный пароль отвечает 401, но сессия при этом жива: этот 401 значит
    // «это не ваш пароль», а не «войдите заново».
    meta: { skipSessionExpiry: true },
  })
  const canDelete = profile.isGuest ? confirmation : password !== ''
  const passwordError = formState.errors.password?.message
  const confirmationError = formState.errors.confirmation?.message
  const formError = formState.errors.root?.message

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (!next) {
      reset()
      clearErrors()
      deleteAccount.reset()
    }
  }

  const submit = handleSubmit(async (values) => {
    clearErrors()
    try {
      await deleteAccount.mutateAsync(
        profile.isGuest ? {} : { body: { password: values.password } },
      )
    } catch (error) {
      const described = describeDeleteError(error)
      if (described.field) {
        setError(described.field, { type: 'server', message: described.message })
      } else {
        setError('root', { type: 'server', message: described.message })
      }
      return
    }

    setOpen(false)
    toast('Аккаунт удалён', 'success')
    await forgetSession()
    await navigate('/login', { replace: true })
  })

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3 border-t border-danger/40 pt-4"
    >
      <h3 id={titleId} className="text-sm font-semibold text-danger">
        Опасно
      </h3>
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-danger/40 p-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium">Удалить аккаунт</span>
          <span className="text-xs text-fg-muted">
            Аккаунт и личные данные удалятся навсегда. Сообщения в общих каналах останутся, но будут
            от «удалённого».
          </span>
        </div>
        <Dialog open={open} onOpenChange={changeOpen}>
          <DialogTrigger asChild>
            <Button variant="danger" size="sm">
              Удалить аккаунт
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Удалить аккаунт?</DialogTitle>
            <DialogDescription>
              Навсегда удалятся профиль, аватар, друзья, блокировки, настройки уведомлений, все
              сессии и участия в серверах. Сообщения в общих каналах останутся от «удалённого», а
              личная переписка — собеседнику. Отменить это нельзя.
            </DialogDescription>
            <form
              aria-label="Удаление аккаунта"
              noValidate
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                void submit(event)
              }}
            >
              {profile.isGuest ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-start gap-2">
                    <input
                      id={confirmationId}
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 accent-danger"
                      aria-invalid={confirmationError !== undefined}
                      {...register('confirmation', {
                        required: 'Подтвердите, что понимаете последствия.',
                      })}
                    />
                    <label htmlFor={confirmationId} className="text-sm">
                      Я понимаю, что аккаунт удалится навсегда
                    </label>
                  </div>
                  {confirmationError !== undefined && (
                    <p role="alert" className="text-sm text-danger">
                      {confirmationError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <Label htmlFor={passwordId}>Пароль</Label>
                  <Input
                    id={passwordId}
                    type="password"
                    autoComplete="current-password"
                    aria-invalid={passwordError !== undefined}
                    {...register('password', { required: 'Введите пароль.' })}
                  />
                  {passwordError !== undefined && (
                    <p role="alert" className="text-sm text-danger">
                      {passwordError}
                    </p>
                  )}
                </div>
              )}

              {formError !== undefined && (
                <p role="alert" className="text-sm text-danger">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Отмена
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  variant="danger"
                  disabled={!canDelete || deleteAccount.isPending}
                >
                  {deleteAccount.isPending ? 'Удаляем…' : 'Удалить навсегда'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  )
}

const describeDeleteError = (error: unknown): DeleteErrorText => {
  if (!isApiError(error)) {
    return { message: 'Не получилось удалить аккаунт. Попробуйте ещё раз.' }
  }
  if (error.isNetworkError) {
    return { message: 'Нет соединения с сервером.' }
  }
  if (error.status === 401) {
    return { field: 'password', message: 'Неверный пароль.' }
  }
  if (error.status === 409) {
    return {
      message:
        'Вы владелец сервера. Пока сервер не передан другому участнику или не удалён, удалить аккаунт нельзя — иначе сообщество исчезло бы вместе с ним.',
    }
  }
  return { message: 'Не получилось удалить аккаунт. Попробуйте ещё раз.' }
}
