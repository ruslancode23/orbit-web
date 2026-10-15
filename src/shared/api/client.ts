import { ApiError, CLIENT_ERROR_CODES } from './api-error'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

export type ApiRequest = <T>(path: string, options?: RequestOptions) => Promise<T>

export function createApiClient(baseUrl: string): ApiRequest {
  const base = baseUrl.replace(/\/+$/, '')

  return async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, signal } = options

    let response: Response
    try {
      response = await fetch(`${base}${path}`, {
        method,
        signal,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      // An aborted request is a cancellation, not a failure: let callers see it as is.
      if (signal?.aborted) throw error
      throw new ApiError({
        status: 0,
        code: CLIENT_ERROR_CODES.network,
        message: 'Нет соединения с сервером',
        cause: error,
      })
    }

    if (!response.ok) {
      throw await toApiError(response)
    }
    if (response.status === 204) {
      return undefined as T
    }
    try {
      return (await response.json()) as T
    } catch (error) {
      throw new ApiError({
        status: response.status,
        code: CLIENT_ERROR_CODES.invalidResponse,
        message: 'Сервер вернул некорректный ответ',
        cause: error,
      })
    }
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null)
  if (isErrorBody(body)) {
    return new ApiError({ status: response.status, ...body.error })
  }
  return new ApiError({
    status: response.status,
    code: CLIENT_ERROR_CODES.http,
    message: `Ошибка сервера (${String(response.status)})`,
  })
}

function isErrorBody(body: unknown): body is { error: { code: string; message: string } } {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false
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
