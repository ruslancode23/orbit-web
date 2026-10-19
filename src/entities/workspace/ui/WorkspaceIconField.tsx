import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'

import { checkImageFile, formatMegabytes, IMAGE_TYPES } from '@/shared/lib/image'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { ImageCropper } from '@/shared/ui/image-cropper'

import { WorkspaceAvatar } from './WorkspaceAvatar'
import { ICON_SIZE, ICON_SOURCE_MAX_BYTES, type WorkspaceIconChange } from '../model/form'

interface WorkspaceIconFieldProps {
  value: WorkspaceIconChange
  onChange: (value: WorkspaceIconChange) => void
  /** The server's name, for the initials in the preview. */
  name: string
  /** The icon the server has now, if any. */
  currentIconUrl?: string | null
  colorKey?: string
  /** A refusal of the server about the icon. */
  error?: string
}

/**
 * Picks a server icon: a PNG, JPEG or WebP picture, cut to a square in a
 * dialog, previewed as the avatar it will be. Type and size are checked here
 * only to say so early — the server checks the bytes again.
 */
export const WorkspaceIconField = ({
  value,
  onChange,
  name,
  currentIconUrl = null,
  colorKey,
  error,
}: WorkspaceIconFieldProps) => {
  const labelId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [cropSource, setCropSource] = useState<string | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)

  // The picked file is shown through an object URL; let it go with the field.
  const sourceRef = useRef<string | null>(null)
  useEffect(
    () => () => {
      if (sourceRef.current) {
        URL.revokeObjectURL(sourceRef.current)
      }
    },
    [],
  )

  const shown =
    value.kind === 'set' ? value.previewUrl : value.kind === 'remove' ? null : currentIconUrl
  const message = pickError ?? error

  const closeCropper = () => {
    if (sourceRef.current) {
      URL.revokeObjectURL(sourceRef.current)
    }
    sourceRef.current = null
    setCropSource(null)
  }

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // The same file may be picked again after a cancel.
    event.target.value = ''
    if (!file) {
      return
    }
    const problem = checkImageFile(file, ICON_SOURCE_MAX_BYTES)
    if (problem === 'type') {
      setPickError('Подойдёт только изображение PNG, JPEG или WebP.')
      return
    }
    if (problem === 'size') {
      setPickError(`Файл больше ${formatMegabytes(ICON_SOURCE_MAX_BYTES)}. Выберите поменьше.`)
      return
    }
    setPickError(null)
    const url = URL.createObjectURL(file)
    sourceRef.current = url
    setCropSource(url)
  }

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <span id={labelId} className="text-sm font-medium text-fg">
        Аватар
      </span>
      <div className="flex items-center gap-4">
        <WorkspaceAvatar
          name={name.trim() || '?'}
          iconUrl={shown}
          colorKey={colorKey}
          size="xl"
          decorative
        />
        <div className="flex flex-col items-start gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-describedby={message ? errorId : undefined}
              onClick={() => inputRef.current?.click()}
            >
              {shown ? 'Заменить' : 'Выбрать изображение'}
            </Button>
            {shown && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPickError(null)
                  onChange(currentIconUrl ? { kind: 'remove' } : { kind: 'keep' })
                }}
              >
                Убрать
              </Button>
            )}
          </div>
          <p className="text-xs text-fg-muted">PNG, JPEG или WebP. Обрежем по квадрату.</p>
        </div>
      </div>
      {message && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_TYPES.join(',')}
        aria-label="Файл изображения"
        tabIndex={-1}
        hidden
        onChange={pick}
      />
      <Dialog
        open={cropSource !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeCropper()
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>Обрезка аватара</DialogTitle>
          <DialogDescription>Выберите, какая часть изображения станет аватаром.</DialogDescription>
          {cropSource && (
            <ImageCropper
              src={cropSource}
              outputSize={ICON_SIZE}
              onCancel={closeCropper}
              onCrop={({ blob, dataUrl }) => {
                onChange({ kind: 'set', file: blob, previewUrl: dataUrl })
                closeCropper()
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
