import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { formatSize, type Attachment } from '@/entities/attachment'
import { isApiError, uploadAttachmentWithProgress } from '@/shared/api'
import { env } from '@/shared/config'

/** The server takes at most this many files per message. */
export const MAX_ATTACHMENTS = 10

interface Base {
  key: string
  file: File
}

export type UploadItem =
  | (Base & { status: 'uploading'; progress: number })
  | (Base & { status: 'done'; attachment: Attachment })
  /** Refused before sending (too big, too many) or failed on the way. */
  | (Base & { status: 'failed'; reason: string })

/** Checked before a byte is sent: a file the server would refuse is not uploaded at all. */
export function rejectReason(file: File, maxBytes = env.maxUploadBytes): string | undefined {
  if (file.size > maxBytes) {
    return `Файл больше ${formatSize(maxBytes)} — такой не загрузить.`
  }
  return undefined
}

function describeUploadError(error: unknown): string {
  if (!isApiError(error)) {
    return 'Не получилось загрузить файл.'
  }
  if (error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  if (error.status === 413) {
    return 'Файл больше, чем принимает сервер.'
  }
  if (error.status === 415) {
    return 'Такой тип файла не принимается.'
  }
  if (error.status === 403) {
    return 'В этом канале нельзя прикладывать файлы.'
  }
  return 'Не получилось загрузить файл.'
}

const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

/**
 * Files on their way into the next message of a channel. Each one is uploaded
 * on its own as soon as it is picked, so the message itself only names them.
 * Switching channels drops the unfinished ones: a file belongs to one channel.
 */
export function useAttachmentUploads(channelId: string) {
  const [items, setItems] = useState<UploadItem[]>([])
  const controllersRef = useRef(new Map<string, AbortController>())
  // Through a mutation, so a 401 here signs the person out like any request.
  const { mutateAsync } = useMutation({ mutationFn: uploadAttachmentWithProgress })

  useEffect(() => {
    const controllers = controllersRef.current
    return () => {
      for (const controller of controllers.values()) {
        controller.abort()
      }
      controllers.clear()
      setItems([])
    }
  }, [channelId])

  const update = (key: string, next: (item: UploadItem) => UploadItem) => {
    setItems((list) => list.map((item) => (item.key === key ? next(item) : item)))
  }

  const start = (file: File) => {
    const key = crypto.randomUUID()
    const controller = new AbortController()
    controllersRef.current.set(key, controller)
    setItems((list) => [...list, { key, file, status: 'uploading', progress: 0 }])

    mutateAsync({
      channelId,
      file,
      signal: controller.signal,
      onProgress: ({ loaded, total }) => {
        update(key, (item) =>
          item.status === 'uploading' ? { ...item, progress: total ? loaded / total : 0 } : item,
        )
      },
    }).then(
      (attachment) => {
        controllersRef.current.delete(key)
        update(key, (item) => ({ key: item.key, file: item.file, status: 'done', attachment }))
      },
      (error: unknown) => {
        controllersRef.current.delete(key)
        // A cancelled upload has already left the list.
        if (isAbort(error)) {
          return
        }
        update(key, (item) => ({
          key: item.key,
          file: item.file,
          status: 'failed',
          reason: describeUploadError(error),
        }))
      },
    )
  }

  const add = (files: readonly File[]) => {
    let free = MAX_ATTACHMENTS - items.filter((item) => item.status !== 'failed').length
    for (const file of files) {
      const reason =
        rejectReason(file) ??
        (free <= 0 ? `В одном сообщении — не больше ${String(MAX_ATTACHMENTS)} файлов.` : undefined)
      if (reason) {
        setItems((list) => [...list, { key: crypto.randomUUID(), file, status: 'failed', reason }])
        continue
      }
      free -= 1
      start(file)
    }
  }

  /** Stops the transfer if it is still going and takes the file out of the message. */
  const remove = (key: string) => {
    controllersRef.current.get(key)?.abort()
    controllersRef.current.delete(key)
    setItems((list) => list.filter((item) => item.key !== key))
  }

  /** After the message went out: its files are its own now. */
  const clear = () => {
    setItems([])
  }

  const attachmentIds = items.flatMap((item) =>
    item.status === 'done' ? [item.attachment.id] : [],
  )
  const uploading = items.some((item) => item.status === 'uploading')

  return { items, add, remove, clear, attachmentIds, uploading }
}
