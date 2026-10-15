/** Error codes produced by the client itself; the server adds its own (see orbit-server httpx). */
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
}

/**
 * The single error type of the API layer. `status` is 0 when the request never got
 * a response (offline, DNS, CORS), otherwise the HTTP status.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor({ status, code, message, cause }: ApiErrorInit) {
    super(message, { cause })
    this.name = 'ApiError'
    this.status = status
    this.code = code
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
