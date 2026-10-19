import { isApiError } from '@/shared/api'

/** Network failures and refused actions read differently; the rest is one line. */
export function describeActionError(error: unknown, fallback: string): string {
  if (!isApiError(error)) {
    return fallback
  }
  if (error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  if (error.status === 403) {
    return 'Недостаточно прав для этого действия.'
  }
  return fallback
}
