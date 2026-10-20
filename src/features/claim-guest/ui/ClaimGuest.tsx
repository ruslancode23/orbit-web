import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'

import { useSession } from '@/entities/session'
import {
  claimGuestAccountMutation,
  getCurrentUserQueryKey,
  isApiError,
  type SelfProfile,
} from '@/shared/api'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

/** The server asks for at least this; saying so beforehand is kinder than a 400. */
const MIN_PASSWORD_LENGTH = 10

/** The same shape the server accepts for a name. */
const NAME_PATTERN = /^[A-Za-z0-9А-Яа-яЁё][A-Za-z0-9А-Яа-яЁё _.-]{0,31}$/

interface ClaimValues {
  nickname: string
  email: string
  password: string
}

/**
 * A guest keeps its id, servers and history when it becomes a full account;
 * the server only adds a password (and an email when given). The banner stays
 * out of the way until the guest asks for it, and disappears once the account
 * is no longer a guest.
 */
export const ClaimGuest = () => {
  const { user } = useSession()

  if (user?.isGuest !== true) {
    return null
  }

  // Keyed by id so the form starts from this guest's name, not from an empty one.
  return <ClaimForm key={user.id} guest={user} />
}

const ClaimForm = ({ guest }: { guest: SelfProfile }) => {
  const [open, setOpen] = useState(false)
  const nicknameId = useId()
  const emailId = useId()
  const passwordId = useId()
  const queryClient = useQueryClient()

  const { register, handleSubmit, formState } = useForm<ClaimValues>({
    defaultValues: {
      nickname: guest.nickname,
      email: '',
      password: '',
    },
  })

  const claim = useMutation({
    ...claimGuestAccountMutation(),
    onSuccess: (account) => {
      // Same id, now a full account: the session query is the one to update.
      queryClient.setQueryData(getCurrentUserQueryKey(), account)
    },
  })

  if (!open) {
    return (
      <div className="flex flex-col gap-1 text-xs text-fg-muted">
        <p>Вы вошли как гость.</p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setOpen(true)
          }}
        >
          Создать аккаунт
        </Button>
      </div>
    )
  }

  const problem =
    formState.errors.nickname?.message ??
    formState.errors.password?.message ??
    (claim.error ? describeClaimError(claim.error) : null)

  const submit = handleSubmit((values) => {
    const email = values.email.trim()
    claim.mutate({
      body: {
        nickname: values.nickname.trim(),
        password: values.password,
        ...(email ? { email } : {}),
      },
    })
  })

  return (
    <form
      aria-label="Создание аккаунта"
      className="flex flex-col gap-2 rounded-md bg-surface p-2"
      onSubmit={(event) => {
        void submit(event)
      }}
    >
      <h3 className="text-sm font-semibold">Аккаунт гостя</h3>
      <p className="text-xs text-fg-muted">Серверы, сообщения и история останутся с вами.</p>

      <div className="flex flex-col gap-1">
        <Label htmlFor={nicknameId} className="text-xs">
          Ник
        </Label>
        <Input
          id={nicknameId}
          autoComplete="username"
          maxLength={32}
          aria-invalid={formState.errors.nickname ? true : undefined}
          {...register('nickname', {
            validate: (value) => value.trim().length > 0 || 'Введите ник.',
            pattern: {
              value: NAME_PATTERN,
              message: 'Можно буквы, цифры, пробел, точку, дефис и подчёркивание.',
            },
          })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={emailId} className="text-xs">
          Email (необязательно)
        </Label>
        <Input id={emailId} type="email" autoComplete="email" {...register('email')} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={passwordId} className="text-xs">
          Пароль
        </Label>
        <Input
          id={passwordId}
          type="password"
          autoComplete="new-password"
          aria-invalid={formState.errors.password ? true : undefined}
          {...register('password', {
            required: 'Придумайте пароль.',
            minLength: {
              value: MIN_PASSWORD_LENGTH,
              message: `Пароль должен быть не короче ${String(MIN_PASSWORD_LENGTH)} символов.`,
            },
          })}
        />
      </div>

      {problem && (
        <p role="alert" className="text-xs text-danger">
          {problem}
        </p>
      )}

      <div className="flex gap-1">
        <Button type="submit" size="sm" disabled={claim.isPending}>
          {claim.isPending ? 'Сохраняем…' : 'Создать аккаунт'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false)
          }}
        >
          Позже
        </Button>
      </div>
    </form>
  )
}

const describeClaimError = (error: unknown): string => {
  if (!isApiError(error)) {
    return 'Не получилось создать аккаунт. Попробуйте ещё раз.'
  }
  if (error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  if (error.status === 409) {
    return 'Этот ник или email уже заняты.'
  }
  if (error.status === 403) {
    return 'Эта сессия уже не гостевая.'
  }
  if (error.status === 400) {
    return 'Проверьте ник и пароль: сервер их не принял.'
  }
  return 'Не получилось создать аккаунт. Попробуйте ещё раз.'
}
