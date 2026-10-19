import { env } from '@/shared/config'

import { ApiError, CLIENT_ERROR_CODES, toApiError } from './api-error'
import { uploadAttachmentResponseTransformer } from './generated/transformers.gen'

import type { Attachment } from './generated/types.gen'

export interface UploadProgress {
  loaded: number
  total: number
}

export interface UploadAttachmentVariables {
  channelId: string
  file: File
  signal?: AbortSignal
  onProgress?: (progress: UploadProgress) => void
}

/**
 * `POST /channels/{channelId}/attachments` with upload progress and cancelling.
 * The generated SDK sends through `fetch`, which cannot report how much of the
 * body has gone out; XMLHttpRequest can, so this one request is written by hand.
 * It answers like the SDK does: the transformed `Attachment`, or an `ApiError`.
 * Cancelling rejects with the browser's `AbortError`, as an aborted fetch would.
 */
export function uploadAttachmentWithProgress({
  channelId,
  file,
  signal,
  onProgress,
}: UploadAttachmentVariables): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }

    const request = new XMLHttpRequest()
    const url = new URL(`/api/v1/channels/${encodeURIComponent(channelId)}/attachments`, env.apiUrl)
    request.open('POST', url)
    // The session cookie, as `credentials: 'include'` does for the SDK.
    request.withCredentials = true

    const cancel = () => {
      request.abort()
    }
    signal?.addEventListener('abort', cancel, { once: true })
    const done = () => {
      signal?.removeEventListener('abort', cancel)
    }

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress?.({ loaded: event.loaded, total: event.total })
      }
    })
    request.addEventListener('abort', () => {
      done()
      reject(abortError())
    })
    request.addEventListener('error', () => {
      done()
      reject(
        new ApiError({
          status: 0,
          code: CLIENT_ERROR_CODES.network,
          message: 'Нет соединения с сервером',
        }),
      )
    })
    request.addEventListener('load', () => {
      done()
      const body = parseJson(request.responseText)
      const response = new Response(null, { status: request.status })
      if (!response.ok) {
        reject(asError(toApiError(body, response), request.status))
        return
      }
      uploadAttachmentResponseTransformer(body).then(resolve, (error: unknown) => {
        reject(asError(toApiError(error, response), request.status))
      })
    })

    const form = new FormData()
    form.append('file', file)
    request.send(form)
  })
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

// toApiError hands back ApiError for every failed response; this only satisfies the type.
function asError(error: unknown, status: number): Error {
  if (error instanceof Error) {
    return error
  }
  return new ApiError({
    status,
    code: CLIENT_ERROR_CODES.http,
    message: `Ошибка сервера (${String(status)})`,
  })
}

function abortError(): DOMException {
  return new DOMException('The upload was cancelled', 'AbortError')
}
