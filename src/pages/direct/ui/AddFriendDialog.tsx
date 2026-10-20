import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'

import { useSendFriendRequest } from '@/entities/friend'
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
import { UserPlusIcon, XIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

/** The one answer the server gives, whatever happened behind it. */
const NEUTRAL_ANSWER = 'Если такой пользователь есть, он получит заявку'

interface AddFriendValues {
  nickname: string
}

const normalizeNickname = (value: string): string => {
  return value.trim().replace(/^@/u, '')
}

/**
 * «Добавить в друзья»: an exact handle in, the same neutral sentence out.
 * Nothing here may say whether the account exists — the server answers 202
 * for a missing account, a refused request and a stored one alike.
 */
const AddFriendDialog = () => {
  const fieldId = useId()
  const hintId = useId()
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const send = useSendFriendRequest()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<AddFriendValues>({ defaultValues: { nickname: '' } })

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setSent(false)
      reset()
      send.reset()
    }
  }

  const submit = handleSubmit((values) => {
    send.mutate(
      { body: { nickname: normalizeNickname(values.nickname) } },
      {
        onSuccess: () => {
          setSent(true)
        },
        onError: (error) => {
          setError('root', {
            message:
              isApiError(error) && error.message !== ''
                ? error.message
                : 'Не удалось отправить заявку. Попробуйте ещё раз.',
          })
        },
      },
    )
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="primary">
          <UserPlusIcon className="size-4" />
          Добавить в друзья
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle>Добавить в друзья</DialogTitle>
            <DialogDescription>
              Введите точный ник. Мы не подсказываем, существует ли такой аккаунт.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <IconButton label="Закрыть">
              <XIcon />
            </IconButton>
          </DialogClose>
        </div>

        {sent ? (
          <div className="flex flex-col gap-4">
            <p
              role="status"
              className="rounded-md border border-border bg-surface-hover px-3 py-2 text-sm text-fg"
            >
              {NEUTRAL_ANSWER}
            </p>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Закрыть
              </Button>
            </DialogClose>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              void submit(event)
            }}
            className="flex flex-col gap-3"
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={fieldId}>Ник</Label>
              <Input
                id={fieldId}
                autoComplete="off"
                placeholder="@nickname"
                aria-describedby={hintId}
                aria-invalid={errors.nickname ? true : undefined}
                {...register('nickname', {
                  required: 'Введите ник',
                  validate: (value) => {
                    const nickname = normalizeNickname(value)
                    if (nickname === '') {
                      return 'Введите ник'
                    }
                    if (!/^[A-Za-z0-9А-Яа-яЁё][A-Za-z0-9А-Яа-яЁё _.-]{0,31}$/u.test(nickname)) {
                      return 'Ник может содержать буквы, цифры, пробел, точку, «_» и «-»'
                    }
                    return true
                  },
                })}
              />
              <p id={hintId} className="text-xs text-fg-muted">
                Ник чувствителен к написанию? Нет
              </p>
              {errors.nickname?.message && (
                <p role="alert" className="text-sm text-danger">
                  {errors.nickname.message}
                </p>
              )}
            </div>

            {errors.root?.message && (
              <p role="alert" className="text-sm text-danger">
                {errors.root.message}
              </p>
            )}

            <Button type="submit" disabled={send.isPending} aria-busy={send.isPending}>
              Отправить заявку
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default AddFriendDialog
