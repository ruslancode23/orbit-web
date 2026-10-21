import { isApiError, type ApiError } from '@/shared/api'
import { pluralRu } from '@/shared/lib/plural'

/** A field of the account forms a refusal of the server is about. */
export type AccountField = 'nickname' | 'email' | 'currentPassword' | 'newPassword'

export interface AccountErrorText<Field extends AccountField = AccountField> {
  /** Where to show it; none means the form as a whole. */
  field?: Field
  message: string
}

/** «через 45 мин» / «через 30 секунд», from the server's `Retry-After`. */
const retryAfterText = (error: ApiError): string => {
  const seconds = error.retryAfterSeconds
  if (seconds === undefined) {
    return 'Попробуйте позже.'
  }
  if (seconds >= 60) {
    return `Попробуйте снова через ${String(Math.ceil(seconds / 60))} мин.`
  }
  return `Попробуйте снова через ${String(seconds)} ${pluralRu(seconds, ['секунду', 'секунды', 'секунд'])}.`
}

const networkText = 'Нет соединения с сервером.'

/** A new nickname: taken, reserved, rate-limited or not a valid handle. */
export function describeNicknameError(
  error: unknown,
): AccountErrorText<'nickname' | 'currentPassword'> {
  const fallback = 'Не получилось сменить ник. Попробуйте ещё раз.'
  if (!isApiError(error)) {
    return { message: fallback }
  }
  if (error.isNetworkError) {
    return { message: networkText }
  }
  if (error.status === 409) {
    return {
      field: 'nickname',
      message: 'Этот ник занят. Освободившийся ник держится 7 дней и пока недоступен.',
    }
  }
  if (error.status === 401) {
    return { field: 'currentPassword', message: 'Неверный текущий пароль.' }
  }
  if (error.status === 403) {
    return { message: 'Гость не может сменить ник — сначала создайте аккаунт.' }
  }
  if (error.status === 400) {
    return {
      field: 'nickname',
      message:
        'Ник не подошёл: можно буквы, цифры, пробел, точку, дефис и подчёркивание, до 32 символов.',
    }
  }
  if (error.status === 429) {
    return { message: `Слишком часто. ${retryAfterText(error)}` }
  }
  return { message: fallback }
}

/** A new email: taken, malformed, or the password was wrong. */
export function describeEmailError(error: unknown): AccountErrorText<'email' | 'currentPassword'> {
  const fallback = 'Не получилось сменить почту. Попробуйте ещё раз.'
  if (!isApiError(error)) {
    return { message: fallback }
  }
  if (error.isNetworkError) {
    return { message: networkText }
  }
  if (error.status === 409) {
    return { field: 'email', message: 'Эта почта уже привязана к другому аккаунту.' }
  }
  if (error.status === 401) {
    return { field: 'currentPassword', message: 'Неверный текущий пароль.' }
  }
  if (error.status === 403) {
    return { message: 'Гость не может сменить почту — сначала создайте аккаунт.' }
  }
  if (error.status === 400) {
    return { field: 'email', message: 'Проверьте адрес почты: сервер его не принял.' }
  }
  if (error.status === 429) {
    return { message: `Слишком часто. ${retryAfterText(error)}` }
  }
  return { message: fallback }
}

/** A new password: too short, the same as before, or the current one is wrong. */
export function describePasswordError(
  error: unknown,
): AccountErrorText<'currentPassword' | 'newPassword'> {
  const fallback = 'Не получилось сменить пароль. Попробуйте ещё раз.'
  if (!isApiError(error)) {
    return { message: fallback }
  }
  if (error.isNetworkError) {
    return { message: networkText }
  }
  if (error.status === 401) {
    return { field: 'currentPassword', message: 'Неверный текущий пароль.' }
  }
  if (error.status === 400) {
    return {
      field: 'newPassword',
      message: 'Новый пароль не подошёл: он должен быть не короче 10 символов.',
    }
  }
  if (error.status === 403) {
    return { message: 'Гость не может сменить пароль — сначала создайте аккаунт.' }
  }
  if (error.status === 429) {
    return { message: `Слишком часто. ${retryAfterText(error)}` }
  }
  return { message: fallback }
}
