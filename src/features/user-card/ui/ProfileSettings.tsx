import { useEffect } from 'react'
import { FormProvider, useWatch } from 'react-hook-form'

import type { UserProfile } from '@/shared/api'
import { Button } from '@/shared/ui/button'
import { useToast } from '@/shared/ui/toast'

import { ProfileFields } from './ProfileFields'
import { UserCardDetails } from './UserCardDetails'
import { avatarPreviewUrl, type ProfileValues } from '../model/profile-form'
import { useProfileEditor } from '../model/useProfileEditor'

interface ProfileSettingsProps {
  profile: UserProfile
  /** Tells the settings dialog whether leaving the tab would lose edits. */
  onDirtyChange?: (dirty: boolean) => void
}

/**
 * «Профиль» in the user settings: the form on the left, the same card other
 * people see on the right. It follows every keystroke, so the accent, avatar,
 * name and bio are chosen by looking at the result instead of guessing.
 */
export const ProfileSettings = ({ profile, onDirtyChange }: ProfileSettingsProps) => {
  const toast = useToast()
  const { form, save, pending, failure, avatarFailure, clearFailures } = useProfileEditor(profile)
  const { control, handleSubmit, formState, reset } = form
  const displayName = useWatch({ control, name: 'displayName' })
  const bio = useWatch({ control, name: 'bio' })
  const accentColor = useWatch({ control, name: 'accentColor' })
  const avatar = useWatch({ control, name: 'avatar' })

  useEffect(() => {
    onDirtyChange?.(formState.isDirty)
  }, [formState.isDirty, onDirtyChange])

  const avatarUrl = avatarPreviewUrl(profile, avatar)
  const preview: UserProfile = {
    ...profile,
    displayName,
    bio,
    accentColor,
    ...(avatarUrl === undefined ? {} : { avatarUrl }),
  }

  const submit = handleSubmit(async (values: ProfileValues) => {
    const saved = await save(values)
    if (saved) {
      // The reset inside the save marks the form clean; say it now so a close
      // right after saving never asks about changes that are already gone.
      onDirtyChange?.(false)
      toast('Профиль сохранён', 'success')
    }
  })

  return (
    <FormProvider {...form}>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_18rem]">
        <form
          aria-label="Профиль"
          noValidate
          className="flex min-w-0 flex-col gap-4"
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

          <div className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-surface pt-3 pb-1">
            <Button type="submit" disabled={pending || !formState.isDirty}>
              {pending ? 'Сохраняем…' : 'Сохранить'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending || !formState.isDirty}
              onClick={() => {
                reset()
                clearFailures()
                onDirtyChange?.(false)
              }}
            >
              Сбросить
            </Button>
            <p role="status" className="text-sm text-fg-muted">
              {pending ? 'Сохраняем…' : null}
            </p>
          </div>
        </form>

        <section aria-label="Предпросмотр профиля" className="flex min-w-0 flex-col gap-2">
          <h3 className="text-sm font-medium text-fg">Так вас видят другие</h3>
          <div className="overflow-hidden rounded-panel border border-border">
            <UserCardDetails profile={preview} isMe mode="preview" onEdit={() => undefined} />
          </div>
        </section>
      </div>
    </FormProvider>
  )
}
