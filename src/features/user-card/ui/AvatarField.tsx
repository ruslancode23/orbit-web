import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'

import { UserAvatar } from '@/entities/user'
import type { UserProfile } from '@/shared/api'
import { checkImageFile, formatMegabytes, IMAGE_TYPES } from '@/shared/lib/image'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { ImageCropper } from '@/shared/ui/image-cropper'

import {
  AVATAR_SIZE,
  AVATAR_SOURCE_MAX_BYTES,
  avatarPreviewUrl,
  type ProfileValues,
} from '../model/profile-form'

interface AvatarFieldProps {
  profile: UserProfile
  /** A refusal of the upload; the field says it under the buttons. */
  error?: string | undefined
}

/**
 * The avatar of the profile form: the picture as it will look, a picker that
 * cuts it to a circle, and removal. A picked file stays in the form until the
 * form is saved, so «Сбросить» brings the current avatar back.
 */
export const AvatarField = ({ profile, error }: AvatarFieldProps) => {
  const labelId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [cropSource, setCropSource] = useState<string | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)
  const { control, setValue } = useFormContext<ProfileValues>()
  const avatar = useWatch({ control, name: 'avatar' })
  const displayName = useWatch({ control, name: 'displayName' })
  const accentColor = useWatch({ control, name: 'accentColor' })

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

  const shown = avatarPreviewUrl(profile, avatar)
  const preview = {
    nickname: profile.nickname,
    displayName,
    avatarUrl: shown,
    accentColor,
  }
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
    const problem = checkImageFile(file, AVATAR_SOURCE_MAX_BYTES)
    if (problem === 'type') {
      setPickError('Подойдёт только изображение PNG, JPEG или WebP.')
      return
    }
    if (problem === 'size') {
      setPickError(`Файл больше ${formatMegabytes(AVATAR_SOURCE_MAX_BYTES)}. Выберите поменьше.`)
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
        <UserAvatar profile={preview} size={80} className="ring-4 ring-surface" />
        <div className="flex flex-col items-start gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-describedby={message ? errorId : undefined}
              onClick={() => inputRef.current?.click()}
            >
              {shown ? 'Заменить аватар' : 'Загрузить аватар'}
            </Button>
            {shown && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPickError(null)
                  setValue('avatar', { kind: 'remove' }, { shouldDirty: true })
                }}
              >
                Удалить аватар
              </Button>
            )}
          </div>
          <p className="text-xs text-fg-muted">PNG, JPEG или WebP до 8 МБ. Обрежем по кругу.</p>
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
        aria-label="Файл аватара"
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
          <DialogDescription>
            Выберите, какая часть изображения станет вашим аватаром.
          </DialogDescription>
          {cropSource && (
            <ImageCropper
              src={cropSource}
              outputSize={AVATAR_SIZE}
              shape="circle"
              onCancel={closeCropper}
              onCrop={({ blob, dataUrl }) => {
                setValue(
                  'avatar',
                  { kind: 'set', file: blob, previewUrl: dataUrl },
                  { shouldDirty: true },
                )
                closeCropper()
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
