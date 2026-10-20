import { Dialog } from 'radix-ui'
import { useState } from 'react'

import { DownloadIcon, FileIcon, XIcon } from '@/shared/ui/icon'
import { Tooltip } from '@/shared/ui/tooltip'

import {
  formatSize,
  isImage,
  previewSize,
  useAttachmentLink,
  type Attachment,
} from '../model/attachment'

interface AttachmentListProps {
  attachments: readonly Attachment[]
}

/** The files of one message: images as previews, everything else as a download. */
export const AttachmentList = ({ attachments }: AttachmentListProps) => {
  if (attachments.length === 0) {
    return null
  }
  return (
    <ul aria-label="Вложения" className="mt-1 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          {isImage(attachment) ? (
            <ImageAttachment attachment={attachment} />
          ) : (
            <FileAttachment attachment={attachment} />
          )}
        </li>
      ))}
    </ul>
  )
}

/** Stands in for a file that cannot be shown: the rest of the list goes on. */
const Unavailable = ({ attachment }: { attachment: Attachment }) => {
  return (
    <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-fg-muted">
      Вложение недоступно: {attachment.fileName}
    </p>
  )
}

/** A signed link that opens the file in a new tab; it is a hint, not a label. */
const DownloadLink = ({ href, fileName }: { href: string; fileName: string }) => {
  return (
    <Tooltip content="Скачать">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Скачать ${fileName}`}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        <DownloadIcon />
      </a>
    </Tooltip>
  )
}

const FileAttachment = ({ attachment }: { attachment: Attachment }) => {
  const { data: link, isError } = useAttachmentLink(attachment.id)
  if (isError) {
    return <Unavailable attachment={attachment} />
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-hover text-fg-muted">
        <FileIcon />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{attachment.fileName}</span>
        <span className="text-xs text-fg-muted">{formatSize(attachment.sizeBytes)}</span>
      </span>
      {link ? (
        <DownloadLink href={link.url} fileName={attachment.fileName} />
      ) : (
        <span className="text-xs text-fg-muted">Готовим ссылку…</span>
      )}
    </div>
  )
}

const ImageAttachment = ({ attachment }: { attachment: Attachment }) => {
  const { data: link, isError } = useAttachmentLink(attachment.id)
  // A link can be fine while the file behind it is not (removed, or a format
  // the browser cannot draw): the <img> says so by failing to load.
  const [broken, setBroken] = useState(false)
  const size = previewSize(attachment)

  if (isError || broken) {
    return <Unavailable attachment={attachment} />
  }
  if (!link) {
    return (
      <div
        role="status"
        aria-label={`Загружаем ${attachment.fileName}`}
        className="rounded-md bg-surface"
        style={{ width: size.width, height: size.height }}
      />
    )
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={`Открыть ${attachment.fileName} в полном размере`}
          className="block overflow-hidden rounded-md focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          <img
            src={link.url}
            alt={attachment.fileName}
            width={size.width}
            height={size.height}
            loading="lazy"
            className="object-cover"
            style={{ width: size.width, height: size.height }}
            onError={() => {
              setBroken(true)
            }}
          />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg/90" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-4 z-50 flex flex-col gap-3 rounded-md bg-surface p-4 focus-visible:outline-none"
        >
          <div className="flex items-center gap-3">
            <Dialog.Title className="min-w-0 flex-1 truncate text-sm font-semibold">
              {attachment.fileName}
            </Dialog.Title>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Скачать ${attachment.fileName}`}
              className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <DownloadIcon />
            </a>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Закрыть"
                title="Закрыть"
                className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                <XIcon />
              </button>
            </Dialog.Close>
          </div>
          <img src={link.url} alt={attachment.fileName} className="min-h-0 flex-1 object-contain" />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
