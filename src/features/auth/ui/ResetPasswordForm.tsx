import { useMutation } from '@tanstack/react-query'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'

import { isApiError, resetPasswordMutation } from '@/shared/api'
import { describeRetryAfter } from '@/shared/lib/retry-after'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

import { AuthForm } from './AuthForm'
import { MIN_PASSWORD_LENGTH, SHORT_PASSWORD_MESSAGE } from '../model/password'

interface ResetPasswordFormProps {
  /** Одноразовый токен из письма; null или пусто, если в адресе его нет. */
  token: string | null
}

interface ResetPasswordValues {
  password: string
  confirmPassword: string
}

/**
 * Вторая половина восстановления: новый пароль по токену из письма. Успешный
 * ответ отзывает все сеансы, поэтому следующий шаг — снова войти. Без токена в
 * адресе отправлять нечего, и экран говорит об этом, а не показывает форму,
 * которая может ответить только 400.
 */
export const ResetPasswordForm = ({ token }: ResetPasswordFormProps) => {
  if (token === null || token.trim() === '') {
    return <MissingToken />
  }
  return <ResetPasswordFields token={token} />
}

const MissingToken = () => {
  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold">В ссылке нет токена</h1>
      <p className="text-sm text-fg-muted">
        Ссылка неполная: в адресе нет токена восстановления. Возможно, она обрезалась при
        копировании — запросите новую.
      </p>
      <Link to="/forgot-password" className="text-sm text-accent underline underline-offset-2">
        Запросить новую ссылку
      </Link>
      <Link to="/login" className="text-sm text-fg-muted underline underline-offset-2">
        Вернуться ко входу
      </Link>
    </div>
  )
}

const ResetPasswordFields = ({ token }: { token: string }) => {
  const passwordId = useId()
  const confirmId = useId()
  const hintId = useId()
  const { register, handleSubmit, formState } = useForm<ResetPasswordValues>({
    defaultValues: { password: '', confirmPassword: '' },
  })
  const reset = useMutation(resetPasswordMutation())

  const problem =
    formState.errors.password?.message ??
    formState.errors.confirmPassword?.message ??
    (reset.error ? describeResetError(reset.error) : null)

  if (reset.isSuccess) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold">Пароль изменён</h1>
        <p className="text-sm text-fg-muted">
          Пароль изменён, войдите с новым. Все прежние сеансы завершены — это защита на случай, если
          старый пароль кто-то знал.
        </p>
        <Link to="/login" className="text-sm text-accent underline underline-offset-2">
          Войти
        </Link>
      </div>
    )
  }

  return (
    <AuthForm
      title="Новый пароль"
      submitLabel="Сменить пароль"
      busy={reset.isPending}
      error={problem ?? null}
      onSubmit={handleSubmit((values) => {
        reset.mutate({ body: { token, password: values.password } })
      })}
      footer={
        <>
          Ссылка не работает? <Link to="/forgot-password">Запросите новую</Link>
        </>
      }
    >
      <p id={hintId} className="text-sm text-fg-muted">
        Не короче {String(MIN_PASSWORD_LENGTH)} символов. После сохранения нужно войти снова.
      </p>

      <div className="flex flex-col gap-1">
        <Label htmlFor={passwordId}>Новый пароль</Label>
        <Input
          id={passwordId}
          type="password"
          autoComplete="new-password"
          aria-describedby={hintId}
          aria-invalid={formState.errors.password ? true : undefined}
          {...register('password', {
            required: 'Придумайте пароль.',
            minLength: { value: MIN_PASSWORD_LENGTH, message: SHORT_PASSWORD_MESSAGE },
          })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={confirmId}>Повторите новый пароль</Label>
        <Input
          id={confirmId}
          type="password"
          autoComplete="new-password"
          aria-invalid={formState.errors.confirmPassword ? true : undefined}
          {...register('confirmPassword', {
            required: 'Повторите пароль.',
            validate: (value, values) => value === values.password || 'Пароли не совпадают.',
          })}
        />
      </div>
    </AuthForm>
  )
}

const describeResetError = (error: unknown): string => {
  if (!isApiError(error)) {
    return 'Не получилось сменить пароль. Попробуйте ещё раз.'
  }
  if (error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  // Сервер не говорит, неизвестен токен, просрочен или уже использован, — и мы
  // тоже не говорим.
  if (error.status === 400) {
    return 'Ссылка недействительна, просрочена или уже использована. Запросите новую.'
  }
  if (error.status === 429) {
    return `Слишком много попыток с этой ссылкой. ${describeRetryAfter(error.retryAfterSeconds)}`
  }
  return 'Не получилось сменить пароль. Попробуйте ещё раз.'
}
