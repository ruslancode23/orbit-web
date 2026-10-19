import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { getCurrentUserQueryKey, isApiError, registerMutation } from '@/shared/api'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

import { AuthForm } from './AuthForm'

/** The server asks for at least this; saying so beforehand is kinder than a 400. */
const MIN_PASSWORD_LENGTH = 10

export function RegisterForm() {
  const nicknameId = useId()
  const emailId = useId()
  const passwordId = useId()
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const signUp = useMutation({
    ...registerMutation(),
    onSuccess: async (user) => {
      queryClient.setQueryData(getCurrentUserQueryKey(), user)
      await navigate('/', { replace: true })
    },
  })

  function submit() {
    setLocalError(null)
    if (!nickname.trim()) return
    if (password.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`Пароль должен быть не короче ${String(MIN_PASSWORD_LENGTH)} символов.`)
      return
    }
    signUp.mutate({
      body: {
        nickname: nickname.trim(),
        password,
        ...(email.trim() ? { email: email.trim() } : {}),
      },
    })
  }

  return (
    <AuthForm
      title="Регистрация"
      submitLabel="Создать аккаунт"
      busy={signUp.isPending}
      error={localError ?? (signUp.error ? describeRegisterError(signUp.error) : null)}
      onSubmit={submit}
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
          value={nickname}
          autoComplete="username"
          onChange={(event) => {
            setNickname(event.target.value)
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={emailId}>Email (необязательно)</Label>
        <Input
          id={emailId}
          type="email"
          value={email}
          autoComplete="email"
          onChange={(event) => {
            setEmail(event.target.value)
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={passwordId}>Пароль</Label>
        <Input
          id={passwordId}
          type="password"
          value={password}
          autoComplete="new-password"
          onChange={(event) => {
            setPassword(event.target.value)
          }}
        />
      </div>
    </AuthForm>
  )
}

function describeRegisterError(error: unknown): string {
  if (!isApiError(error)) return 'Не получилось создать аккаунт. Попробуйте ещё раз.'
  if (error.isNetworkError) return 'Нет соединения с сервером.'
  if (error.status === 409) return 'Этот ник или email уже заняты.'
  if (error.status === 400) return 'Проверьте ник и пароль: сервер их не принял.'
  return 'Не получилось создать аккаунт. Попробуйте ещё раз.'
}
