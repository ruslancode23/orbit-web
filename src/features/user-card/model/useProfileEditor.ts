import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { applyUserProfile } from '@/entities/live'
import {
  deleteMyAvatarMutation,
  updateMyProfileMutation,
  uploadMyAvatarMutation,
  type UserProfile,
} from '@/shared/api'

import {
  describeAvatarError,
  describeProfileError,
  profileUpdateFrom,
  profileValuesFrom,
  type ProfileValues,
} from './profile-form'

/**
 * One editor for the profile: the settings tab and the quick dialog both use
 * it. The text fields go in one PATCH, the avatar in its own upload or delete;
 * each answer replaces the profile in every cache through `applyUserProfile`.
 */
export const useProfileEditor = (profile: UserProfile) => {
  const queryClient = useQueryClient()
  // `defaultValues`, not reactive `values`: a successful save resets the form
  // itself, and the server answer must not turn the clean form dirty again.
  const form = useForm<ProfileValues>({ defaultValues: profileValuesFrom(profile) })
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const [avatarFailure, setAvatarFailure] = useState<string | undefined>(undefined)
  const update = useMutation(updateMyProfileMutation())
  const uploadAvatar = useMutation(uploadMyAvatarMutation())
  const deleteAvatar = useMutation(deleteMyAvatarMutation())

  const pending = update.isPending || uploadAvatar.isPending || deleteAvatar.isPending

  /** Saves what changed; a refusal lands on its field or above the form. */
  const save = async (values: ProfileValues): Promise<UserProfile | null> => {
    setFailure(undefined)
    setAvatarFailure(undefined)
    let current = profile

    const body = profileUpdateFrom(profile, values)
    if (Object.keys(body).length > 0) {
      try {
        current = await update.mutateAsync({ body })
        applyUserProfile(queryClient, current)
        // The text is saved even if the avatar below fails.
        form.resetField('displayName', { defaultValue: current.displayName })
        form.resetField('bio', { defaultValue: current.bio })
        form.resetField('accentColor', { defaultValue: current.accentColor })
      } catch (error) {
        const { field, message } = describeProfileError(error)
        if (field) {
          form.setError(field, { type: 'server', message })
        } else {
          setFailure(message)
        }
        return null
      }
    }

    try {
      if (values.avatar.kind === 'set') {
        current = await uploadAvatar.mutateAsync({ body: { file: values.avatar.file } })
        applyUserProfile(queryClient, current)
      } else if (values.avatar.kind === 'remove') {
        current = await deleteAvatar.mutateAsync({})
        applyUserProfile(queryClient, current)
      }
    } catch (error) {
      setAvatarFailure(describeAvatarError(error))
      return null
    }

    form.reset(profileValuesFrom(current))
    return current
  }

  const clearFailures = () => {
    setFailure(undefined)
    setAvatarFailure(undefined)
  }

  return { form, save, pending, failure, avatarFailure, clearFailures }
}
