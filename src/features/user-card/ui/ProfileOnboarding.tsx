import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FormProvider } from 'react-hook-form'

import { useSession } from '@/entities/session'
import {
  completeMyProfileOnboardingMutation,
  getCurrentUserQueryKey,
  isApiError,
  type SelfProfile,
} from '@/shared/api'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'
import { XIcon } from '@/shared/ui/icon'
import { useToast } from '@/shared/ui/toast'

import { ProfileFields } from './ProfileFields'
import { closeProfileOnboarding, useProfileOnboardingClosed } from '../model/onboarding'
import { useProfileEditor } from '../model/useProfileEditor'

/**
 * The one-time «Заполните профиль» step: the avatar, the display name and the
 * bio, the same fields and the same saving hook as the «Профиль» tab. It is a
 * modal because the fields deserve focus, but it never owns navigation: Esc or
 * the close button put it away for this page session without marking it passed,
 * and «Пропустить» is always there.
 *
 * The server decides whether the step is still due (`profileOnboardedAt` in
 * `GET /auth/me`); this component only reads that flag. Both «Сохранить» and
 * «Пропустить» mark it through `POST /users/me/onboarding`, so another device
 * never shows it again either.
 */
export const ProfileOnboarding = () => {
  const { user } = useSession()
  const closed = useProfileOnboardingClosed(user?.id)

  // A guest cannot pass the step: the server answers 403, and the guest's own
  // card sends them to a full account instead of a form.
  if (!user || user.isGuest || user.profileOnboardedAt !== null || closed) {
    return null
  }
  return <ProfileOnboardingDialog key={user.id} profile={user} />
}

const ProfileOnboardingDialog = ({ profile }: { profile: SelfProfile }) => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { form, save, pending, failure, avatarFailure } = useProfileEditor(profile)
  const { handleSubmit, formState } = form
  const [stepFailure, setStepFailure] = useState<string | undefined>(undefined)
  const complete = useMutation(completeMyProfileOnboardingMutation())

  const close = () => {
    closeProfileOnboarding(profile.id)
  }

  /**
   * Marks the step on the server. A guest answers 403: there is nothing to
   * mark for them, so that answer counts as "no step" rather than a failure.
   * Any other refusal leaves the flag alone — the step will come back later,
   * which is honest and better than losing the profile that was just saved.
   */
  const markPassed = async (): Promise<boolean> => {
    try {
      await complete.mutateAsync({})
    } catch (error) {
      if (isApiError(error) && error.status === 403) {
        return true
      }
      return false
    }
    queryClient.setQueryData<SelfProfile>(getCurrentUserQueryKey(), (current) =>
      current ? { ...current, profileOnboardedAt: new Date() } : current,
    )
    return true
  }

  const skip = async () => {
    setStepFailure(undefined)
    if (complete.isPending) {
      return
    }
    if (await markPassed()) {
      close()
      return
    }
    setStepFailure('Не получилось отметить шаг. Попробуйте ещё раз.')
  }

  const submit = handleSubmit(async (values) => {
    setStepFailure(undefined)
    // Save first: a refused profile must not eat the step. Only a saved (or
    // unchanged) profile is followed by the mark.
    const saved = await save(values)
    if (!saved) {
      return
    }
    if (await markPassed()) {
      close()
      return
    }
    toast('Профиль сохранён, но шаг не отмечен. Он появится снова позже.', 'danger')
    close()
  })

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          close()
        }
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle>Заполните профиль</DialogTitle>
            <DialogDescription>
              Аватар, имя и пара слов о себе — так вас узнают на серверах. Это можно сделать и позже
              в настройках.
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
            {stepFailure !== undefined && (
              <p role="alert" className="text-sm text-danger">
                {stepFailure}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="ghost"
                aria-busy={complete.isPending}
                onClick={() => {
                  void skip()
                }}
              >
                Пропустить
              </Button>
              <Button
                type="submit"
                disabled={pending || complete.isPending}
                aria-busy={pending || complete.isPending}
              >
                {pending ? 'Сохраняем…' : 'Сохранить'}
              </Button>
            </div>
            {!formState.isDirty && (
              <p className="text-xs text-fg-muted">
                Можно ничего не менять и просто пропустить — профиль настроите позже.
              </p>
            )}
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  )
}
