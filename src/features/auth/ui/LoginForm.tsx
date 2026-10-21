import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'

import { getCurrentUserQueryKey, isApiError, loginMutation } from '@/shared/api'
import { describeRetryAfter } from '@/shared/lib/retry-after'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

import { AuthForm } from './AuthForm'
import { useReturnPath } from '../model/return-path'

interface LoginValues {
  login: string
  password: string
}

export const LoginForm = () => {
  const loginId = useId()
  const passwordId = useId()
  const navigate = useNavigate()
  const afterAuth = useReturnPath()
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState } = useForm<LoginValues>({
    defaultValues: { login: '', password: '' },
  })

  const signIn = useMutation({
    ...loginMutation(),
    onSuccess: async (user) => {
      queryClient.setQueryData(getCurrentUserQueryKey(), user)
      // The sign-in answer lacks `profileOnboardedAt` and the email; the shell
      // asks `/auth/me` for the full profile as soon as it mounts.
      await queryClient.invalidateQueries({ queryKey: getCurrentUserQueryKey() })
      await navigate(afterAuth, { replace: true })
    },
  })

  // What the form itself found comes first: the server has not been asked yet.
  const problem =
    formState.errors.login?.message ??
    formState.errors.password?.message ??
    (signIn.error ? describeLoginError(signIn.error) : null)

  return (
    <AuthForm
      title="Вход"
      submitLabel="Войти"
      busy={signIn.isPending}
      error={problem ?? null}
      onSubmit={handleSubmit((values) => {
        signIn.mutate({ body: { login: values.login.trim(), password: values.password } })
      })}
      footer={
        <>
          Нет аккаунта? <Link to="/register">Зарегистрируйтесь</Link>
        </>
      }
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor={loginId}>Ник или email</Label>
        <Input
          id={loginId}
          autoComplete="username"
          aria-invalid={formState.errors.login ? true : undefined}
          {...register('login', { required: 'Введите ник или email.' })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={passwordId}>Пароль</Label>
        <Input
          id={passwordId}
          type="password"
          autoComplete="current-password"
          aria-invalid={formState.errors.password ? true : undefined}
          {...register('password', { required: 'Введите пароль.' })}
        />
      </div>
    </AuthForm>
  )
}

const describeLoginError = (error: unknown): string => {
  if (!isApiError(error)) {
    return 'Не получилось войти. Попробуйте ещё раз.'
  }
  if (error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  // The server does not say which half was wrong, and neither do we.
  if (error.status === 401) {
    return 'Неверный логин или пароль.'
  }
  // Too many wrong passwords for this login, or too many attempts from here.
  if (error.status === 429) {
    return `Слишком много попыток входа. ${describeRetryAfter(error.retryAfterSeconds)}`
  }
  return 'Не получилось войти. Попробуйте ещё раз.'
}
