import type { ErrorDetail } from './generated/types.gen'

/** Error codes produced by the client itself; the server's codes are in api/orbit-server.openapi.yaml. */
export const CLIENT_ERROR_CODES = {
  network: 'network_error',
  http: 'http_error',
  invalidResponse: 'invalid_response',
} as const

interface ApiErrorInit {
  status: number
  code: string
  message: string
  cause?: unknown
  /** The wait the server asked for in `Retry-After`, in seconds. */
  retryAfterSeconds?: number
}

/**
 * The single error type of the API layer: every failed request rejects with it.
 *
 * It has the shape of the server's `Error` schema (`error.code`, `error.message`), so it
 * matches the error types of the generated query and mutation functions. `status` is 0
 * when no response arrived (offline, DNS, CORS), otherwise the HTTP status.
 */
export class ApiError extends Error {
  readonly status: number
  readonly error: ErrorDetail
  /** How long the server asked to wait; set when the answer carries `Retry-After`. */
  readonly retryAfterSeconds: number | undefined

  constructor({ status, code, message, cause, retryAfterSeconds }: ApiErrorInit) {
    super(message, { cause })
    this.name = 'ApiError'
    this.status = status
    this.error = { code, message }
    this.retryAfterSeconds = retryAfterSeconds
  }

  get code(): string {
    return this.error.code
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }

  /** 4xx: repeating the same request will fail the same way. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/**
 * Error interceptor of the generated client: turns whatever the request failed with
 * into an ApiError. A cancelled request is passed through untouched.
 */
export function toApiError(
  error: unknown,
  response: Response | undefined,
  signal?: AbortSignal | null,
): unknown {
  if (isApiError(error) || signal?.aborted || isAbortError(error)) {
    return error
  }
  if (!response) {
    return new ApiError({
      status: 0,
      code: CLIENT_ERROR_CODES.network,
      message: 'Нет соединения с сервером',
      cause: error,
    })
  }
  if (response.ok) {
    return new ApiError({
      status: response.status,
      code: CLIENT_ERROR_CODES.invalidResponse,
      message: 'Сервер вернул некорректный ответ',
      cause: error,
    })
  }
  const retryAfterSeconds = readRetryAfter(response)
  if (isErrorBody(error)) {
    return new ApiError({ status: response.status, ...error.error, retryAfterSeconds })
  }
  return new ApiError({
    status: response.status,
    code: CLIENT_ERROR_CODES.http,
    message: `Ошибка сервера (${String(response.status)})`,
    cause: error,
    retryAfterSeconds,
  })
}

/** `Retry-After` may be a number of seconds or an HTTP date; only seconds are used here. */
function readRetryAfter(response: Response): number | undefined {
  const header = response.headers.get('Retry-After')
  if (header === null) {
    return undefined
  }
  const seconds = Number.parseInt(header, 10)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function isErrorBody(body: unknown): body is { error: ErrorDetail } {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return false
  }
  const { error } = body
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  )
}
