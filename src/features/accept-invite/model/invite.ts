import { isApiError } from '@/shared/api'

const fallback = 'Не получилось присоединиться. Попробуйте ещё раз.'

/** A link that died, a ban and a taken name are different problems for the reader. */
export const describeAcceptError = (error: unknown): string => {
  if (!isApiError(error)) {
    return fallback
  }
  if (error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  if (error.status === 404) {
    return 'Приглашение больше не действует.'
  }
  if (error.status === 403) {
    return 'Вас заблокировали на этом сервере.'
  }
  return fallback
}

export const describeGuestJoinError = (error: unknown): string => {
  if (!isApiError(error)) {
    return fallback
  }
  if (error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  if (error.status === 404) {
    return 'Приглашение больше не действует.'
  }
  if (error.status === 409) {
    return 'Это имя уже занято. Попробуйте другое.'
  }
  if (error.status === 400) {
    return 'Сервер не принял имя. Проверьте его.'
  }
  return fallback
}
