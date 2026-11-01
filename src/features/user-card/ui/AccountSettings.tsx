import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { applyUserProfile } from '@/entities/live'
import { useForgetSession } from '@/entities/session'
import {
  changePasswordMutation,
  getCurrentUserQueryKey,
  updateMyEmailMutation,
  updateMyNicknameMutation,
  type SelfProfile,
} from '@/shared/api'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useToast } from '@/shared/ui/toast'

import { DeleteAccount } from './DeleteAccount'
import {
  describeEmailError,
  describeNicknameError,
  describePasswordError,
} from '../model/account-errors'

/** The same rule the server applies to a nickname. */
const NAME_PATTERN = /^[A-Za-z0-9А-Яа-яЁё][A-Za-z0-9А-Яа-яЁё _.-]{0,31}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u
/** The server asks for at least this; saying so beforehand is kinder than a 400. */
const MIN_PASSWORD_LENGTH = 10

interface AccountSettingsProps {
  profile: SelfProfile
  /**
   * The sign-up form of a guest. It is passed in by the widget because two
   * features must not import each other.
   */
  claimGuest?: ReactNode
}

/**
 * «Аккаунт» in the user settings: the nickname and the email, each confirmed
 * with the current password, the password change and the way out. A guest has
 * no password, so instead of three forms that would answer 403 it sees what a
 * full account adds and the sign-up form.
 */
export const AccountSettings = ({ profile, claimGuest }: AccountSettingsProps) => {
  if (profile.isGuest) {
    return <GuestAccount profile={profile} claimGuest={claimGuest} />
  }
  return <FullAccount profile={profile} />
}

const GuestAccount = ({
  profile,
  claimGuest,
}: {
  profile: SelfProfile
  claimGuest: ReactNode | undefined
}) => {
  const titleId = useId()

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby={titleId} className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">@{profile.nickname}</span>
          <span className="text-xs text-fg-muted">Вы вошли как гость.</span>
        </div>
        <div className="flex flex-col gap-2 rounded-md bg-surface p-3">
          <h3 id={titleId} className="text-sm font-semibold">
            Сначала создайте аккаунт
          </h3>
          <p className="text-xs text-fg-muted">
            Пока у аккаунта нет пароля, ник и почту изменить нельзя. Создание аккаунта сохранит
            серверы, сообщения и историю — гость станет полным аккаунтом с тем же id.
          </p>
          {claimGuest}
        </div>
      </section>
      <DeleteAccount profile={profile} />
    </div>
  )
}

const FullAccount = ({ profile }: { profile: SelfProfile }) => {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-surface p-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">@{profile.nickname}</span>
          <span className="text-xs text-fg-muted">Полный аккаунт</span>
        </div>
        <span className="text-xs text-fg-muted">Почта: {profile.email ?? 'не указана'}</span>
      </div>

      <NicknameForm profile={profile} />
      <EmailForm profile={profile} />
      <PasswordForm />
      <DeleteAccount profile={profile} />
    </div>
  )
}

interface NicknameValues {
  nickname: string
  currentPassword: string
}

const NicknameForm = ({ profile }: { profile: SelfProfile }) => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const nicknameId = useId()
  const passwordId = useId()
  const hintId = useId()
  const limitId = useId()
  const nicknameErrorId = useId()
  const passwordErrorId = useId()
  const { control, register, handleSubmit, formState, reset, setError, setValue, clearErrors } =
    useForm<NicknameValues>({
      values: { nickname: profile.nickname, currentPassword: '' },
      resetOptions: { keepDirtyValues: true },
    })
  const nickname = useWatch({ control, name: 'nickname' })
  const password = useWatch({ control, name: 'currentPassword' })
  const unchanged = nickname.trim() === profile.nickname
  const mutation = useMutation({
    ...updateMyNicknameMutation(),
    meta: { skipSessionExpiry: true },
  })

  const submit = handleSubmit(async (values) => {
    clearErrors()
    try {
      const account = await mutation.mutateAsync({
        body: {
          nickname: values.nickname.trim(),
          currentPassword: values.currentPassword,
        },
      })
      queryClient.setQueryData(getCurrentUserQueryKey(), account)
      applyUserProfile(queryClient, account)
      reset({ nickname: account.nickname, currentPassword: '' })
      setValue('currentPassword', '')
      toast('Ник изменён', 'success')
    } catch (error) {
      const described = describeNicknameError(error)
      if (described.field) {
        setError(described.field, { type: 'server', message: described.message })
      } else {
        setError('root', { type: 'server', message: described.message })
      }
    }
  })

  const nicknameError = formState.errors.nickname?.message
  const passwordError = formState.errors.currentPassword?.message
  const formError = formState.errors.root?.message

  return (
    <form
      aria-label="Смена ника"
      noValidate
      className="flex flex-col gap-3 border-t border-border pt-4"
      onSubmit={(event) => {
        void submit(event)
      }}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Ник</h3>
        <p id={hintId} className="text-xs text-fg-muted">
          Сейчас: @{profile.nickname}. Можно буквы, цифры, пробел, точку, дефис и подчёркивание, до
          32 символов.
        </p>
        <p id={limitId} className="text-xs text-fg-muted">
          Менять ник можно не чаще двух раз в час. Старый ник держится 7 дней и всё это время
          недоступен — в том числе вам.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={nicknameId}>Новый ник</Label>
        <Input
          id={nicknameId}
          autoComplete="username"
          maxLength={32}
          aria-describedby={[hintId, limitId, nicknameError ? nicknameErrorId : '']
            .filter(Boolean)
            .join(' ')}
          aria-invalid={nicknameError !== undefined}
          {...register('nickname', {
            required: 'Введите ник.',
            pattern: {
              value: NAME_PATTERN,
              message: 'Буквы, цифры, пробел, точка, дефис и подчёркивание; до 32 символов.',
            },
          })}
        />
        {nicknameError !== undefined && (
          <p id={nicknameErrorId} role="alert" className="text-sm text-danger">
            {nicknameError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={passwordId}>Текущий пароль</Label>
        <Input
          id={passwordId}
          type="password"
          autoComplete="current-password"
          aria-describedby={passwordError ? passwordErrorId : undefined}
          aria-invalid={passwordError !== undefined}
          {...register('currentPassword', { required: 'Введите текущий пароль.' })}
        />
        {passwordError !== undefined && (
          <p id={passwordErrorId} role="alert" className="text-sm text-danger">
            {passwordError}
          </p>
        )}
      </div>

      {formError !== undefined && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}

      <Button
        type="submit"
        size="sm"
        className="self-start"
        disabled={mutation.isPending || unchanged || password === ''}
      >
        {mutation.isPending ? 'Сохраняем…' : 'Сменить ник'}
      </Button>
    </form>
  )
}

interface EmailValues {
  email: string
  currentPassword: string
}

const EmailForm = ({ profile }: { profile: SelfProfile }) => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const emailId = useId()
  const passwordId = useId()
  const hintId = useId()
  const emailErrorId = useId()
  const passwordErrorId = useId()
  const { control, register, handleSubmit, formState, reset, setError, setValue, clearErrors } =
    useForm<EmailValues>({
      values: { email: profile.email ?? '', currentPassword: '' },
      resetOptions: { keepDirtyValues: true },
    })
  const email = useWatch({ control, name: 'email' })
  const password = useWatch({ control, name: 'currentPassword' })
  const unchanged = email.trim() === (profile.email ?? '')
  const mutation = useMutation({
    ...updateMyEmailMutation(),
    meta: { skipSessionExpiry: true },
  })

  const submit = handleSubmit(async (values) => {
    clearErrors()
    try {
      const account = await mutation.mutateAsync({
        body: { email: values.email.trim(), currentPassword: values.currentPassword },
      })
      queryClient.setQueryData(getCurrentUserQueryKey(), account)
      applyUserProfile(queryClient, account)
      reset({ email: account.email ?? '', currentPassword: '' })
      setValue('currentPassword', '')
      toast((account.email ?? '') === '' ? 'Почта удалена' : 'Почта обновлена', 'success')
    } catch (error) {
      const described = describeEmailError(error)
      if (described.field) {
        setError(described.field, { type: 'server', message: described.message })
      } else {
        setError('root', { type: 'server', message: described.message })
      }
    }
  })

  const emailError = formState.errors.email?.message
  const passwordError = formState.errors.currentPassword?.message
  const formError = formState.errors.root?.message

  return (
    <form
      aria-label="Смена почты"
      noValidate
      className="flex flex-col gap-3 border-t border-border pt-4"
      onSubmit={(event) => {
        void submit(event)
      }}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Почта</h3>
        <p id={hintId} className="text-xs text-fg-muted">
          Сейчас: {profile.email ?? 'не указана'}. Пустое поле уберёт почту — вход останется по
          нику. Адрес пока не подтверждается письмом.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={emailId}>Новая почта</Label>
        <Input
          id={emailId}
          type="email"
          autoComplete="email"
          aria-describedby={[hintId, emailError ? emailErrorId : ''].filter(Boolean).join(' ')}
          aria-invalid={emailError !== undefined}
          {...register('email', {
            validate: (value) =>
              value.trim() === '' ||
              EMAIL_PATTERN.test(value.trim()) ||
              'Введите адрес почты или оставьте поле пустым.',
          })}
        />
        {emailError !== undefined && (
          <p id={emailErrorId} role="alert" className="text-sm text-danger">
            {emailError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={passwordId}>Текущий пароль</Label>
        <Input
          id={passwordId}
          type="password"
          autoComplete="current-password"
          aria-describedby={passwordError ? passwordErrorId : undefined}
          aria-invalid={passwordError !== undefined}
          {...register('currentPassword', { required: 'Введите текущий пароль.' })}
        />
        {passwordError !== undefined && (
          <p id={passwordErrorId} role="alert" className="text-sm text-danger">
            {passwordError}
          </p>
        )}
      </div>

      {formError !== undefined && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}

      <Button
        type="submit"
        size="sm"
        className="self-start"
        disabled={mutation.isPending || unchanged || password === ''}
      >
        {mutation.isPending ? 'Сохраняем…' : 'Сменить почту'}
      </Button>
    </form>
  )
}

interface PasswordValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const PasswordForm = () => {
  const toast = useToast()
  const navigate = useNavigate()
  const forgetSession = useForgetSession()
  const currentId = useId()
  const newId = useId()
  const confirmId = useId()
  const hintId = useId()
  const currentErrorId = useId()
  const newErrorId = useId()
  const confirmErrorId = useId()
  const { register, handleSubmit, formState, setError, clearErrors } = useForm<PasswordValues>({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const mutation = useMutation({
    ...changePasswordMutation(),
    meta: { skipSessionExpiry: true },
  })

  const submit = handleSubmit(async (values) => {
    clearErrors()
    try {
      await mutation.mutateAsync({
        body: { currentPassword: values.currentPassword, newPassword: values.newPassword },
      })
      toast('Пароль изменён. Войдите снова.', 'success')
      await forgetSession()
      await navigate('/login', { replace: true })
    } catch (error) {
      const described = describePasswordError(error)
      if (described.field) {
        setError(described.field, { type: 'server', message: described.message })
      } else {
        setError('root', { type: 'server', message: described.message })
      }
    }
  })

  const currentError = formState.errors.currentPassword?.message
  const newError = formState.errors.newPassword?.message
  const confirmError = formState.errors.confirmPassword?.message
  const formError = formState.errors.root?.message

  return (
    <form
      aria-label="Смена пароля"
      noValidate
      className="flex flex-col gap-3 border-t border-border pt-4"
      onSubmit={(event) => {
        void submit(event)
      }}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Пароль</h3>
        <p id={hintId} className="text-xs text-fg-muted">
          Смена пароля завершит все сеансы, включая этот: после сохранения нужно войти снова.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={currentId}>Текущий пароль</Label>
        <Input
          id={currentId}
          type="password"
          autoComplete="current-password"
          aria-describedby={currentError ? currentErrorId : undefined}
          aria-invalid={currentError !== undefined}
          {...register('currentPassword', { required: 'Введите текущий пароль.' })}
        />
        {currentError !== undefined && (
          <p id={currentErrorId} role="alert" className="text-sm text-danger">
            {currentError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={newId}>Новый пароль</Label>
        <Input
          id={newId}
          type="password"
          autoComplete="new-password"
          aria-describedby={newError ? newErrorId : hintId}
          aria-invalid={newError !== undefined}
          {...register('newPassword', {
            required: 'Придумайте пароль.',
            minLength: {
              value: MIN_PASSWORD_LENGTH,
              message: `Пароль должен быть не короче ${String(MIN_PASSWORD_LENGTH)} символов.`,
            },
          })}
        />
        {newError !== undefined && (
          <p id={newErrorId} role="alert" className="text-sm text-danger">
            {newError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={confirmId}>Повторите новый пароль</Label>
        <Input
          id={confirmId}
          type="password"
          autoComplete="new-password"
          aria-describedby={confirmError ? confirmErrorId : undefined}
          aria-invalid={confirmError !== undefined}
          {...register('confirmPassword', {
            required: 'Повторите пароль.',
            validate: (value, values) => value === values.newPassword || 'Пароли не совпадают.',
          })}
        />
        {confirmError !== undefined && (
          <p id={confirmErrorId} role="alert" className="text-sm text-danger">
            {confirmError}
          </p>
        )}
      </div>

      {formError !== undefined && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}

      <Button type="submit" size="sm" className="self-start" disabled={mutation.isPending}>
        {mutation.isPending ? 'Сохраняем…' : 'Сменить пароль'}
      </Button>
    </form>
  )
}
