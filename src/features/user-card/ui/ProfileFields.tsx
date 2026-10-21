import { useFormContext, useWatch } from 'react-hook-form'

import type { UserProfile } from '@/shared/api'
import { cn } from '@/shared/lib/cn'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'

import { AvatarField } from './AvatarField'
import {
  ACCENT_OPTIONS,
  BIO_MAX,
  DISPLAY_NAME_MAX,
  type ProfileValues,
} from '../model/profile-form'

interface ProfileFieldsProps {
  profile: UserProfile
  /** The upload's refusal, shown under the avatar buttons. */
  avatarError?: string | undefined
}

/**
 * The profile fields shared by the settings tab and the quick editor: the
 * avatar, the display name, the bio with its counter and the accent palette.
 * It lives in a `FormProvider`, so the same form drives the live card next to it.
 */
export const ProfileFields = ({ profile, avatarError }: ProfileFieldsProps) => {
  const { control, register, setValue, formState } = useFormContext<ProfileValues>()
  const bio = useWatch({ control, name: 'bio' })
  const accentColor = useWatch({ control, name: 'accentColor' })
  const nameError = formState.errors.displayName?.message
  const bioError = formState.errors.bio?.message

  return (
    <div className="flex flex-col gap-5">
      <AvatarField profile={profile} error={avatarError} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-display-name">Отображаемое имя</Label>
        <Input
          id="profile-display-name"
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="nickname"
          aria-describedby={[
            'profile-display-name-hint',
            nameError ? 'profile-display-name-error' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={nameError !== undefined}
          {...register('displayName', {
            maxLength: {
              value: DISPLAY_NAME_MAX,
              message: `Не больше ${String(DISPLAY_NAME_MAX)} символов.`,
            },
          })}
        />
        <p id="profile-display-name-hint" className="text-xs text-fg-muted">
          Пустое имя — показываем ник @{profile.nickname}.
        </p>
        {nameError !== undefined && (
          <p id="profile-display-name-error" role="alert" className="text-sm text-danger">
            {nameError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="profile-bio">О себе</Label>
          <p
            id="profile-bio-counter"
            aria-live="polite"
            className={cn(
              'text-xs tabular-nums',
              bio.length >= BIO_MAX ? 'text-warning' : 'text-fg-muted',
            )}
          >
            {`${String(bio.length)} / ${String(BIO_MAX)}`}
          </p>
        </div>
        <Textarea
          id="profile-bio"
          rows={4}
          maxLength={BIO_MAX}
          aria-describedby={[
            'profile-bio-counter',
            'profile-bio-hint',
            bioError ? 'profile-bio-error' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={bioError !== undefined}
          {...register('bio', {
            maxLength: { value: BIO_MAX, message: `Не больше ${String(BIO_MAX)} символов.` },
          })}
        />
        <p id="profile-bio-hint" className="text-xs text-fg-muted">
          Пара слов о себе — их видят все, кто открывает вашу карточку.
        </p>
        {bioError !== undefined && (
          <p id="profile-bio-error" role="alert" className="text-sm text-danger">
            {bioError}
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-fg">Цвет акцента</legend>
        <p className="text-xs text-fg-muted">Он красит фон за аватаром и инициалы.</p>
        <div className="flex flex-wrap gap-2">
          {ACCENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-label={option.label}
              aria-pressed={accentColor === option.value}
              title={option.label}
              className={cn(
                'size-8 rounded-full transition-shadow focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none',
                option.swatch,
                accentColor === option.value
                  ? 'ring-2 ring-fg ring-offset-2 ring-offset-surface'
                  : 'hover:ring-2 hover:ring-border hover:ring-offset-2 hover:ring-offset-surface',
              )}
              onClick={() => {
                setValue('accentColor', option.value, { shouldDirty: true })
              }}
            />
          ))}
        </div>
      </fieldset>
    </div>
  )
}
