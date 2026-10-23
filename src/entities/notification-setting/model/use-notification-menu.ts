import { LEVEL_OPTIONS, MUTE_OPTIONS, isNotificationMuted } from './levels'
import { useNotificationLevel } from './use-notification-settings'

import type { NotificationTarget, StoredNotificationLevel } from './levels'

/** One level in the menu, with whether it is the account's current choice. */
export interface NotificationMenuLevel {
  value: StoredNotificationLevel
  label: string
  selected: boolean
}

/** Everything both menu flavours draw for one channel, server or conversation. */
export interface NotificationMenu {
  levels: NotificationMenuLevel[]
  mutes: typeof MUTE_OPTIONS
  /** Set while a mute deadline is running, so the menu can say until when. */
  mutedUntil: Date | undefined
  /** Offers «Включить уведомления»: the target is silent for a reason to undo. */
  canEnable: boolean
  pending: boolean
  error: unknown
  choose: (level: StoredNotificationLevel) => void
  muteFor: (ms: number) => void
  muteForever: () => void
  enable: () => void
}

/**
 * The state behind the «Уведомления» submenu. The level shown as chosen is the
 * account's own row, so «Как на сервере» is visible as such even when the
 * inherited level is mentions; the mute deadline is described separately.
 */
export const useNotificationMenu = (target: NotificationTarget): NotificationMenu => {
  const controls = useNotificationLevel(target)
  const selected = controls.own?.level ?? 'inherit'
  const mutedUntil = isNotificationMuted(controls.own)
    ? (controls.own?.mutedUntil ?? undefined)
    : undefined

  return {
    // A server or a conversation has nothing to inherit from on the menu, so
    // the row keeps the inherited value only for a channel.
    levels: LEVEL_OPTIONS.filter(
      (option) => target.scope === 'channel' || option.value !== 'inherit',
    ).map((option) => ({ ...option, selected: selected === option.value })),
    mutes: MUTE_OPTIONS,
    mutedUntil,
    canEnable: mutedUntil !== undefined || controls.level === 'none',
    pending: controls.pending,
    error: controls.error,
    choose: controls.setLevel,
    muteFor: controls.muteFor,
    muteForever: controls.muteIndefinitely,
    enable: controls.clear,
  }
}
