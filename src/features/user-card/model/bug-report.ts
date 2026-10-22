import { isApiError } from '@/shared/api'
import { describeRetryAfter } from '@/shared/lib/retry-after'

/** The same limits as `POST /bug-reports` in orbit-server. */
export const MAX_BUG_DESCRIPTION = 4000
export const MAX_BUG_STEPS = 4000
/** Keep equal to the server's `ORBIT_MAX_SCREENSHOT_BYTES`; checked here only to say it early. */
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024
export const SCREENSHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
/** The server stores at most this much of the browser line and of the route. */
const MAX_USER_AGENT = 512
const MAX_ROUTE = 512

/** A field of the report form a refusal of the server is about. */
export type BugReportField = 'description' | 'steps' | 'screenshot'

export interface BugReportErrorText {
  /** Where to show it; none means the form as a whole. */
  field?: BugReportField
  message: string
}

/**
 * Path segments that are secrets in their own right: an invite code opens a
 * server, and a secret chat should not be named in a report at all. The
 * template stays, so the team still knows which screen it was.
 */
const SECRET_SEGMENTS: readonly { pattern: RegExp; template: string }[] = [
  { pattern: /^\/invite\/[^/]+/, template: '/invite/:code' },
  { pattern: /^\/me\/s\/[^/]+/, template: '/me/s/:secretChatId' },
]

/** The route a report names: the path alone, with secret segments masked. */
export const reportRoute = (pathname: string): string => {
  const path = pathname.split(/[?#]/)[0] ?? ''
  const route = path.startsWith('/') ? path : `/${path}`
  const masked = SECRET_SEGMENTS.reduce(
    (current, { pattern, template }) => current.replace(pattern, template),
    route,
  )
  return masked.slice(0, MAX_ROUTE)
}

/** The browser line as the server keeps it. */
export const reportUserAgent = (line: string): string => line.slice(0, MAX_USER_AGENT)

const isScreenshotType = (type: string): boolean =>
  SCREENSHOT_TYPES.some((accepted) => accepted === type)

/** Why a picked file cannot be a screenshot, or undefined when it can. */
export const screenshotProblem = (file: File): string | undefined => {
  if (!isScreenshotType(file.type)) {
    return 'Нужна картинка PNG, JPEG или WebP.'
  }
  if (file.size === 0) {
    return 'Файл пустой.'
  }
  if (file.size > MAX_SCREENSHOT_BYTES) {
    return 'Скриншот больше 5 МБ — уменьшите его или обрежьте.'
  }
  return undefined
}

/** The field a 400 names: the server starts its message with it, the schema check quotes it. */
const fieldOf = (message: string): BugReportField | undefined => {
  if (/(^|")\/?screenshot\b/.test(message)) {
    return 'screenshot'
  }
  if (/(^|")\/?steps\b/.test(message)) {
    return 'steps'
  }
  if (/(^|")\/?description\b/.test(message)) {
    return 'description'
  }
  return undefined
}

/** A refusal of the server, laid out by the field it is about. */
export const describeBugReportError = (error: unknown): BugReportErrorText => {
  const fallback = 'Не получилось отправить отчёт. Попробуйте ещё раз.'
  if (!isApiError(error)) {
    return { message: fallback }
  }
  if (error.isNetworkError) {
    return { message: 'Нет соединения с сервером. Текст останется в форме — отправьте позже.' }
  }
  if (error.status === 400) {
    const field = fieldOf(error.message)
    if (field === 'screenshot') {
      return { field, message: 'Сервер не смог прочитать скриншот. Попробуйте другой файл.' }
    }
    if (field === 'steps') {
      return { field, message: `Шаги не подошли: до ${String(MAX_BUG_STEPS)} символов.` }
    }
    if (field === 'description') {
      return {
        field,
        message: `Опишите, что случилось: до ${String(MAX_BUG_DESCRIPTION)} символов.`,
      }
    }
    return { message: 'Сервер не принял отчёт. Обновите страницу и попробуйте ещё раз.' }
  }
  if (error.status === 413) {
    return { field: 'screenshot', message: 'Скриншот слишком большой для сервера — до 5 МБ.' }
  }
  if (error.status === 415) {
    return { field: 'screenshot', message: 'Нужна картинка PNG, JPEG или WebP.' }
  }
  if (error.status === 429) {
    return {
      message: `Вы отправили много отчётов подряд. ${describeRetryAfter(error.retryAfterSeconds)}`,
    }
  }
  return { message: fallback }
}
