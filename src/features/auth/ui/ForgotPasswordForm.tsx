import { useMutation } from '@tanstack/react-query'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'

import { isApiError, requestPasswordResetMutation } from '@/shared/api'
import { describeRetryAfter } from '@/shared/lib/retry-after'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

import { AuthForm } from './AuthForm'

interface ForgotPasswordValues {
  login: string
}

/**
 * Просит сервер прислать ссылку для сброса пароля. Ответ всегда один и тот же
 * 204: аккаунта может не быть, у него может не быть почты, а на этом инстансе
 * может быть выключена отправка. Поэтому экран говорит только «если аккаунт
 * существует» — любой другой ответ стал бы способом проверять, кто здесь есть.
 */
export const ForgotPasswordForm = () => {
  const loginId = useId()
  const { register, handleSubmit, formState } = useForm<ForgotPasswordValues>({
    defaultValues: { login: '' },
  })
  const request = useMutation(requestPasswordResetMutation())

  const problem =
    formState.errors.login?.message ?? (request.error ? describeRequestError(request.error) : null)

  if (request.isSuccess) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold">Проверьте почту</h1>
        <p className="text-sm text-fg-muted">
          Если аккаунт существует, письмо отправлено. Перейдите по ссылке из письма — она действует
          час и открывается один раз.
        </p>
        <p className="text-sm text-fg-muted">
          Письма нет? Проверьте папку «Спам» или запросите новую ссылку позже.
        </p>
        <Link to="/login" className="text-sm text-accent underline underline-offset-2">
          Вернуться ко входу
        </Link>
      </div>
    )
  }

  return (
    <AuthForm
      title="Забыли пароль?"
      submitLabel="Отправить ссылку"
      busy={request.isPending}
      error={problem ?? null}
      onSubmit={handleSubmit((values) => {
        request.mutate({ body: { login: values.login.trim() } })
      })}
      footer={
        <>
          Вспомнили пароль? <Link to="/login">Войдите</Link>
        </>
      }
    >
      <p className="text-sm text-fg-muted">
        Укажите ник или почту аккаунта — пришлём ссылку для нового пароля.
      </p>
      <div className="flex flex-col gap-1">
        <Label htmlFor={loginId}>Ник или почта</Label>
        <Input
          id={loginId}
          autoComplete="username"
          aria-invalid={formState.errors.login ? true : undefined}
          {...register('login', { required: 'Введите ник или почту.' })}
        />
      </div>
    </AuthForm>
  )
}

const describeRequestError = (error: unknown): string => {
  if (!isApiError(error)) {
    return 'Не получилось отправить письмо. Попробуйте ещё раз.'
  }
  if (error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  if (error.status === 400) {
    return 'Проверьте ник или почту: сервер их не принял.'
  }
  // Единственный ответ, отличающийся от нейтрального, — и он тоже не зависит
  // от того, существует ли аккаунт.
  if (error.status === 429) {
    return `Слишком много запросов на восстановление. ${describeRetryAfter(error.retryAfterSeconds)}`
  }
  return 'Не получилось отправить письмо. Попробуйте ещё раз.'
}
