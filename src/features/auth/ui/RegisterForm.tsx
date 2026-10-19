import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'

import { getCurrentUserQueryKey, isApiError, registerMutation } from '@/shared/api'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

import { AuthForm } from './AuthForm'

/** The server asks for at least this; saying so beforehand is kinder than a 400. */
const MIN_PASSWORD_LENGTH = 10

interface RegisterValues {
  nickname: string
  email: string
  password: string
}

export const RegisterForm = () => {
  const nicknameId = useId()
  const emailId = useId()
  const passwordId = useId()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState } = useForm<RegisterValues>({
    defaultValues: { nickname: '', email: '', password: '' },
  })

  const signUp = useMutation({
    ...registerMutation(),
    onSuccess: async (user) => {
      queryClient.setQueryData(getCurrentUserQueryKey(), user)
      await navigate('/', { replace: true })
    },
  })

  const problem =
    formState.errors.nickname?.message ??
    formState.errors.password?.message ??
    (signUp.error ? describeRegisterError(signUp.error) : null)

  return (
    <AuthForm
      title="Регистрация"
      submitLabel="Создать аккаунт"
      busy={signUp.isPending}
      error={problem ?? null}
      onSubmit={handleSubmit((values) => {
        const email = values.email.trim()
        signUp.mutate({
          body: {
            nickname: values.nickname.trim(),
            password: values.password,
            ...(email ? { email } : {}),
          },
        })
      })}
      footer={
        <>
          Уже есть аккаунт? <Link to="/login">Войдите</Link>
        </>
      }
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor={nicknameId}>Ник</Label>
        <Input
          id={nicknameId}
          autoComplete="username"
          aria-invalid={formState.errors.nickname ? true : undefined}
          {...register('nickname', { required: 'Придумайте ник.' })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={emailId}>Email (необязательно)</Label>
        <Input id={emailId} type="email" autoComplete="email" {...register('email')} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={passwordId}>Пароль</Label>
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
    </AuthForm>
  )
}

const describeRegisterError = (error: unknown): string => {
  if (!isApiError(error)) {
    return 'Не получилось создать аккаунт. Попробуйте ещё раз.'
  }
  if (error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  if (error.status === 409) {
    return 'Этот ник или email уже заняты.'
  }
  if (error.status === 400) {
    return 'Проверьте ник и пароль: сервер их не принял.'
  }
  return 'Не получилось создать аккаунт. Попробуйте ещё раз.'
}
