import { useEffect, useRef } from 'react'

import { formatSize } from '@/entities/attachment'
import { formatTime } from '@/entities/message'
import type { SecretFile, SecretMessage } from '@/entities/secret-session'
import { cn } from '@/shared/lib/cn'
import { DownloadIcon, FileIcon } from '@/shared/ui/icon'

import { LockIcon } from './icons'
import { remainingLabel, remainingRatio, remainingSeconds } from '../../model/format'

const EMPTY_TEXT = 'Сообщений пока нет. Напишите первым — сообщение зашифруется на этом устройстве.'

const isImageFile = (file: SecretFile): boolean => {
  return file.mimeType.startsWith('image/')
}

/** Saves the decrypted bytes to disk with a temporary object URL. */
const download = (file: SecretFile) => {
  const url = URL.createObjectURL(file.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  // Let the browser start the download before the URL disappears.
  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)
}

/** The decrypted image, with its object URL revoked when the message goes away. */
const ImagePreview = ({ file }: { file: SecretFile }) => {
  const imageRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    const image = imageRef.current
    if (!image) {
      return undefined
    }
    const url = URL.createObjectURL(file.blob)
    image.src = url
    return () => {
      image.removeAttribute('src')
      URL.revokeObjectURL(url)
    }
  }, [file])

  return (
    <img ref={imageRef} alt={file.name} className="max-h-64 max-w-full rounded-md object-contain" />
  )
}

const SecretFileContent = ({ file }: { file: SecretFile }) => {
  if (isImageFile(file)) {
    return <ImagePreview file={file} />
  }

  return (
    <button
      type="button"
      className="flex max-w-full items-center gap-2 text-left underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      onClick={() => {
        download(file)
      }}
    >
      <FileIcon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{file.name}</span>
      <span className="shrink-0 text-xs opacity-80">{formatSize(file.size)}</span>
      <DownloadIcon className="size-4 shrink-0" />
    </button>
  )
}

/** A ring that empties as the timer runs out, with the time left beside it. */
const Countdown = ({ createdAt, expiresAt }: { createdAt: string; expiresAt: string }) => {
  const seconds = remainingSeconds(expiresAt)
  const ratio = remainingRatio(createdAt, expiresAt)
  const circumference = 2 * Math.PI * 5

  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`Исчезнет через ${remainingLabel(seconds)}`}
    >
      <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3 shrink-0">
        <circle
          cx="6"
          cy="6"
          r="5"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeWidth="2"
        />
        <circle
          cx="6"
          cy="6"
          r="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={`${String(circumference * ratio)} ${String(circumference)}`}
          transform="rotate(-90 6 6)"
        />
      </svg>
      <span aria-hidden="true">{remainingLabel(seconds)}</span>
    </span>
  )
}

const SecretMessageRow = ({ message }: { message: SecretMessage }) => {
  if (message.author === 'system') {
    return <p className="w-full px-4 text-center text-xs text-fg-muted">{message.text}</p>
  }

  const own = message.author === 'me'

  return (
    <div className={cn('flex w-full', own ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'flex max-w-[min(32rem,85%)] flex-col gap-1 rounded-panel px-3 py-2 text-sm',
          own ? 'bg-accent text-accent-fg' : 'bg-surface text-fg',
        )}
      >
        {message.kind === 'file' && message.file ? <SecretFileContent file={message.file} /> : null}
        {message.text !== '' ? (
          <p className="break-words whitespace-pre-wrap">{message.text}</p>
        ) : null}
        <div
          className={cn(
            'flex items-center justify-end gap-2 text-xs',
            own ? 'text-accent-fg/80' : 'text-fg-muted',
          )}
        >
          <time dateTime={message.createdAt}>{formatTime(new Date(message.createdAt))}</time>
          {message.expiresAt === undefined ? null : (
            <Countdown createdAt={message.createdAt} expiresAt={message.expiresAt} />
          )}
        </div>
      </div>
    </div>
  )
}

/** The decrypted history of this one chat; nothing here ever leaves the device. */
export const SecretMessages = ({ messages }: { messages: SecretMessage[] }) => {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <LockIcon className="size-8 text-fg-muted" />
        <p className="max-w-sm text-sm text-fg-muted">{EMPTY_TEXT}</p>
      </div>
    )
  }

  return (
    <ol aria-label="Сообщения" className="flex flex-col gap-3 px-4 py-4">
      {messages.map((message) => (
        <li key={message.id} className="flex w-full">
          <SecretMessageRow message={message} />
        </li>
      ))}
    </ol>
  )
}
