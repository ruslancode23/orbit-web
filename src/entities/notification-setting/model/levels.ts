import type { NotificationScope, NotificationSetting } from '@/shared/api'

/** How loudly a target speaks: the same three levels the server stores. */
export type NotificationLevel = 'all' | 'mentions' | 'none'

/** A row may have no level of its own; `inherit` is the API's word for it. */
export type StoredNotificationLevel = NotificationLevel | 'inherit'

/** Which object a level is about: a server, a channel or a conversation. */
export interface NotificationTarget {
  scope: NotificationScope
  targetId: string
  /** The server a channel belongs to; it supplies the inherited level. */
  workspaceId?: string
}

/** Every row of the account, keyed by scope and target. */
export type NotificationSettingsIndex = ReadonlyMap<string, NotificationSetting>

const keyOf = (scope: NotificationScope, targetId: string): string => `${scope}:${targetId}`

/** Builds the lookup the UI and the in-tab notifications read. */
export const indexNotificationSettings = (
  items: readonly NotificationSetting[],
): NotificationSettingsIndex => {
  const index = new Map<string, NotificationSetting>()
  for (const item of items) {
    index.set(keyOf(item.scope, item.targetId), item)
  }
  return index
}

/** The row of one target, when the account has one. */
export const findNotificationSetting = (
  index: NotificationSettingsIndex,
  scope: NotificationScope,
  targetId: string,
): NotificationSetting | undefined => index.get(keyOf(scope, targetId))

/** Whether the target is silent right now because of a deadline. */
export const isNotificationMuted = (
  setting: NotificationSetting | undefined,
  now: number = Date.now(),
): boolean =>
  setting?.mutedUntil !== undefined && setting.mutedUntil !== null
    ? setting.mutedUntil.getTime() > now
    : false

/**
 * The level the server would compute: the target's own, then its server's,
 * then the default — mentions in a server channel, every message in a
 * conversation. A live deadline anywhere on the way silences it.
 */
export const effectiveNotificationLevel = (
  index: NotificationSettingsIndex,
  target: NotificationTarget,
  now: number = Date.now(),
): NotificationLevel => {
  const conversation = target.scope === 'conversation'
  const chain: (NotificationSetting | undefined)[] = conversation
    ? [findNotificationSetting(index, 'conversation', target.targetId)]
    : [
        findNotificationSetting(index, 'channel', target.targetId),
        target.workspaceId === undefined
          ? undefined
          : findNotificationSetting(index, 'workspace', target.workspaceId),
      ]
  if (chain.some((setting) => isNotificationMuted(setting, now))) {
    return 'none'
  }
  for (const setting of chain) {
    if (setting !== undefined && setting.level !== 'inherit') {
      return setting.level
    }
  }
  return conversation ? 'all' : 'mentions'
}

/** The levels a person may pick, in the order the menu shows them. */
export const LEVEL_OPTIONS: readonly { value: StoredNotificationLevel; label: string }[] = [
  { value: 'all', label: 'Все сообщения' },
  { value: 'mentions', label: 'Только упоминания' },
  { value: 'none', label: 'Ничего' },
  { value: 'inherit', label: 'Как на сервере' },
]

/** The mute deadlines the menu offers; «до включения» is the none level. */
export const MUTE_OPTIONS: readonly { id: string; label: string; ms: number }[] = [
  { id: '15m', label: 'На 15 минут', ms: 15 * 60 * 1000 },
  { id: '1h', label: 'На 1 час', ms: 60 * 60 * 1000 },
  { id: '8h', label: 'На 8 часов', ms: 8 * 60 * 60 * 1000 },
  { id: '24h', label: 'На 24 часа', ms: 24 * 60 * 60 * 1000 },
]

/** A level in words, for the menu and the settings note. */
export const describeLevel = (level: NotificationLevel): string => {
  switch (level) {
    case 'all':
      return 'все сообщения'
    case 'mentions':
      return 'только упоминания'
    case 'none':
      return 'ничего'
  }
}

/** When the deadline passes, in the reader's local time. */
export const describeMuteUntil = (until: Date): string => {
  return until.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
