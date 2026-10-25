import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'

import {
  deleteNotificationSettingMutation,
  listNotificationSettingsOptions,
  listNotificationSettingsQueryKey,
  setNotificationSettingMutation,
} from '@/shared/api'

import { takeLegacyConversationMutes } from './legacy-mutes'
import {
  effectiveNotificationLevel,
  findNotificationSetting,
  indexNotificationSettings,
  type NotificationSettingsIndex,
  type NotificationTarget,
  type StoredNotificationLevel,
} from './levels'

/** The rows of every server, channel and conversation the account changed. */
export const useNotificationSettings = () => useQuery(listNotificationSettingsOptions())

/** The same rows as a lookup by scope and target. */
export const useNotificationSettingsIndex = (): NotificationSettingsIndex => {
  const { data } = useNotificationSettings()
  return useMemo(() => indexNotificationSettings(data?.items ?? []), [data])
}

/** What one target's menu shows and the actions behind it. */
export interface NotificationLevelControls {
  /** What the server would compute, inheritance and the mute deadline included. */
  level: ReturnType<typeof effectiveNotificationLevel>
  /** The account's own row, if it made one. */
  own: ReturnType<typeof findNotificationSetting>
  pending: boolean
  error: unknown
  setLevel: (level: StoredNotificationLevel) => void
  /** Silences the target for a while, keeping its level. */
  muteFor: (ms: number) => void
  /** Silences it until the person turns the notifications back on. */
  muteIndefinitely: () => void
  /** Drops the row, returning the target to the inherited level. */
  clear: () => void
}

/**
 * Reads and writes the settings of one target through TanStack Query. The
 * server answers with the stored row; the list is asked again so every menu
 * and the in-tab notifications see the same thing.
 */
export const useNotificationLevel = (target: NotificationTarget): NotificationLevelControls => {
  const queryClient = useQueryClient()
  const index = useNotificationSettingsIndex()
  const own = findNotificationSetting(index, target.scope, target.targetId)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: listNotificationSettingsQueryKey() })
  }
  const update = useMutation({ ...setNotificationSettingMutation(), onSuccess: invalidate })
  const remove = useMutation({ ...deleteNotificationSettingMutation(), onSuccess: invalidate })

  const save = (level: StoredNotificationLevel, mutedUntil: Date | null) => {
    update.mutate({
      path: { scope: target.scope, targetId: target.targetId },
      body: { level, mutedUntil },
    })
  }

  return {
    level: effectiveNotificationLevel(index, target),
    own,
    pending: update.isPending || remove.isPending,
    error: update.error ?? remove.error,
    setLevel: (level) => {
      save(level, null)
    },
    muteFor: (ms) => {
      save(own?.level ?? 'inherit', new Date(Date.now() + ms))
    },
    muteIndefinitely: () => {
      save('none', null)
    },
    clear: () => {
      if (own === undefined) {
        save('inherit', null)
        return
      }
      remove.mutate({ path: { scope: target.scope, targetId: target.targetId } })
    },
  }
}

/**
 * Sends the dialogues muted on this device before the server knew about them.
 * Runs once per mount, after the list arrives, and never overwrites a row the
 * account already has.
 */
export const useMoveLegacyConversationMutes = (): void => {
  const queryClient = useQueryClient()
  const { data, isSuccess } = useNotificationSettings()
  const moved = useRef(false)
  const update = useMutation({
    ...setNotificationSettingMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: listNotificationSettingsQueryKey() })
    },
  })
  const { mutate } = update

  useEffect(() => {
    if (!isSuccess || moved.current) {
      return
    }
    moved.current = true
    const ids = takeLegacyConversationMutes()
    if (ids.length === 0) {
      return
    }
    const known = new Set(
      data.items.filter((item) => item.scope === 'conversation').map((item) => item.targetId),
    )
    for (const targetId of ids) {
      if (known.has(targetId)) {
        continue
      }
      mutate({
        path: { scope: 'conversation', targetId },
        body: { level: 'none', mutedUntil: null },
      })
    }
  }, [isSuccess, data, mutate])
}
