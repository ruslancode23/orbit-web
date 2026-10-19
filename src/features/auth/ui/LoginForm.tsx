import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { getCurrentUserQueryKey, isApiError, loginMutation } from '@/shared/api'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

import { AuthForm } from './AuthForm'

export function LoginForm() {
  const loginId = useId()
  const passwordId = useId()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const signIn = useMutation({
    ...loginMutation(),
    onSuccess: async (user) => {
      // The answer is the account: no need to ask who we are right after.
      queryClient.setQueryData(getCurrentUserQueryKey(), user)
      await navigate('/', { replace: true })
    },
  })

  return (
    <AuthForm
      title="Вход"
      submitLabel="Войти"
      busy={signIn.isPending}
      error={signIn.error ? describeLoginError(signIn.error) : null}
      onSubmit={() => {
        if (!login.trim() || !password) return
        signIn.mutate({ body: { login: login.trim(), password } })
      }}
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
          value={login}
          autoComplete="username"
          onChange={(event) => {
            setLogin(event.target.value)
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={passwordId}>Пароль</Label>
        <Input
          id={passwordId}
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(event) => {
            setPassword(event.target.value)
          }}
        />
      </div>
    </AuthForm>
  )
}

function describeLoginError(error: unknown): string {
  if (!isApiError(error)) return 'Не получилось войти. Попробуйте ещё раз.'
  if (error.isNetworkError) return 'Нет соединения с сервером.'
  // The server does not say which half was wrong, and neither do we.
  if (error.status === 401) return 'Неверный логин или пароль.'
  return 'Не получилось войти. Попробуйте ещё раз.'
}
