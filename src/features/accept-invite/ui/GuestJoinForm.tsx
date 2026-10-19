import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { getCurrentUserQueryKey, joinAsGuestMutation, listWorkspacesQueryKey } from '@/shared/api'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

import { describeGuestJoinError } from '../model/invite'

interface GuestJoinFormProps {
  code: string
}

interface GuestValues {
  nickname: string
}

/** The same shape the server accepts; saying it beforehand is kinder than a 400. */
const NAME_PATTERN = /^[A-Za-z0-9А-Яа-яЁё][A-Za-z0-9А-Яа-яЁё _.-]{0,31}$/

/**
 * The guest entrance: a name is enough, no password. The server creates the
 * account, starts its session and puts it into the server in one step. The name
 * is kept when the guest later turns the account into a full one.
 */
export const GuestJoinForm = ({ code }: GuestJoinFormProps) => {
  const nicknameId = useId()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState } = useForm<GuestValues>({
    defaultValues: { nickname: '' },
  })

  const join = useMutation({
    ...joinAsGuestMutation(),
    onSuccess: async ({ user, membership }) => {
      // The cookie is set; the answer is already the account it belongs to.
      queryClient.setQueryData(getCurrentUserQueryKey(), user)
      await queryClient.invalidateQueries({ queryKey: listWorkspacesQueryKey() })
      await navigate(`/s/${membership.workspace.id}`, { replace: true })
    },
  })

  const problem =
    formState.errors.nickname?.message ?? (join.error ? describeGuestJoinError(join.error) : null)

  const submit = handleSubmit((values) => {
    join.mutate({ path: { code }, body: { nickname: values.nickname.trim() } })
  })

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        void submit(event)
      }}
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor={nicknameId}>Ваше имя</Label>
        <Input
          id={nicknameId}
          autoComplete="nickname"
          maxLength={32}
          aria-invalid={formState.errors.nickname ? true : undefined}
          {...register('nickname', {
            validate: (value) => value.trim().length > 0 || 'Введите имя.',
            pattern: {
              value: NAME_PATTERN,
              message: 'Можно буквы, цифры, пробел, точку, дефис и подчёркивание.',
            },
            maxLength: {
              value: 32,
              message: 'Не длиннее 32 символов.',
            },
          })}
        />
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : (
          <p className="text-xs text-fg-muted">
            Имя видят другие участники. Пароль не нужен — аккаунт можно создать позже.
          </p>
        )}
      </div>

      <Button type="submit" disabled={join.isPending}>
        {join.isPending ? 'Входим…' : 'Войти как гость'}
      </Button>
    </form>
  )
}
