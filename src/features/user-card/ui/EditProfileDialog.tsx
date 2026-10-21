import { FormProvider } from 'react-hook-form'

import type { UserProfile } from '@/shared/api'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'
import { XIcon } from '@/shared/ui/icon'

import { ProfileFields } from './ProfileFields'
import { useProfileEditor } from '../model/useProfileEditor'

interface EditProfileDialogProps {
  profile: UserProfile
  onClose: () => void
}

/**
 * The quick profile editor behind the user card and the user panel. It shares
 * the fields and the saving hook with the «Профиль» tab of the settings, so
 * both change the same things and update the same caches. The custom status
 * has its own dialog, next to the presence menu.
 */
export const EditProfileDialog = ({ profile, onClose }: EditProfileDialogProps) => {
  const { form, save, pending, failure, avatarFailure, clearFailures } = useProfileEditor(profile)
  const { handleSubmit, formState } = form

  const submit = handleSubmit(async (values) => {
    const saved = await save(values)
    if (saved) {
      onClose()
    }
  })

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle>Редактировать профиль</DialogTitle>
            <DialogDescription>
              Имя, аватар, «О себе» и цвет видят все, кто открывает вашу карточку.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <button
              type="button"
              aria-label="Закрыть"
              title="Закрыть"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <XIcon />
            </button>
          </DialogClose>
        </div>

        <FormProvider {...form}>
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(event) => {
              void submit(event)
            }}
          >
            <ProfileFields profile={profile} avatarError={avatarFailure} />

            {failure !== undefined && (
              <p role="alert" className="text-sm text-danger">
                {failure}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    clearFailures()
                  }}
                >
                  Отмена
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending || !formState.isDirty} aria-busy={pending}>
                {pending ? 'Сохраняем…' : 'Сохранить'}
              </Button>
            </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
