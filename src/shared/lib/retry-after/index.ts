import { pluralRu } from '@/shared/lib/plural'

/**
 * «Попробуйте снова через 6 мин.» from the server's `Retry-After`, in seconds.
 * Without a number the sentence just asks to try later.
 */
export const describeRetryAfter = (seconds: number | undefined): string => {
  if (seconds === undefined) {
    return 'Попробуйте позже.'
  }
  if (seconds >= 60) {
    return `Попробуйте снова через ${String(Math.ceil(seconds / 60))} мин.`
  }
  return `Попробуйте снова через ${String(seconds)} ${pluralRu(seconds, ['секунду', 'секунды', 'секунд'])}.`
}
