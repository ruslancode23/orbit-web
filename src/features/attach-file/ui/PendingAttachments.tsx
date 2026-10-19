import { formatSize } from '@/entities/attachment'
import { Button } from '@/shared/ui/button'

import type { UploadItem } from '../model/uploads'

interface PendingAttachmentsProps {
  items: readonly UploadItem[]
  onRemove: (key: string) => void
}

/** The files going into the next message, with their progress and a way out. */
export const PendingAttachments = ({ items, onRemove }: PendingAttachmentsProps) => {
  if (items.length === 0) return null

  return (
    <ul aria-label="Файлы к сообщению" className="flex flex-col gap-1">
      {items.map((item) => {
        const name = item.file.name
        return (
          <li
            key={item.key}
            className="flex items-center gap-2 rounded-md bg-surface px-2 py-1 text-sm"
          >
            <span className="min-w-0 flex-1 truncate">
              {name} <span className="text-xs text-fg-muted">{formatSize(item.file.size)}</span>
            </span>

            {item.status === 'uploading' && (
              <progress
                aria-label={`Загрузка ${name}`}
                value={Math.round(item.progress * 100)}
                max={100}
                className="h-1.5 w-24 accent-accent"
              />
            )}
            {item.status === 'failed' && (
              <span role="alert" className="text-xs text-danger">
                {item.reason}
              </span>
            )}

            <Button
              variant="ghost"
              size="sm"
              aria-label={
                item.status === 'uploading' ? `Отменить загрузку ${name}` : `Убрать ${name}`
              }
              onClick={() => {
                onRemove(item.key)
              }}
            >
              {item.status === 'uploading' ? 'Отменить' : 'Убрать'}
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
