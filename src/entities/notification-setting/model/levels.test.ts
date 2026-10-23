import type { NotificationSetting } from '@/shared/api'

import {
  effectiveNotificationLevel,
  indexNotificationSettings,
  isNotificationMuted,
  type NotificationTarget,
} from './levels'

const now = new Date('2026-10-24T12:00:00Z').getTime()
const channel: NotificationTarget = { scope: 'channel', targetId: 'c-1', workspaceId: 'w-1' }
const conversation: NotificationTarget = { scope: 'conversation', targetId: 'd-1' }

const row = (
  scope: NotificationSetting['scope'],
  targetId: string,
  level: NotificationSetting['level'],
  mutedUntil: Date | null = null,
): NotificationSetting => ({
  scope,
  targetId,
  level,
  mutedUntil,
  updatedAt: new Date('2026-10-24T10:00:00Z'),
})

const levelOf = (rows: NotificationSetting[], target: NotificationTarget) =>
  effectiveNotificationLevel(indexNotificationSettings(rows), target, now)

describe('effectiveNotificationLevel', () => {
  it('defaults a server channel to mentions and a conversation to every message', () => {
    expect(levelOf([], channel)).toBe('mentions')
    expect(levelOf([], conversation)).toBe('all')
  })

  it('lets the channel override its server, and inherits when it does not', () => {
    expect(levelOf([row('workspace', 'w-1', 'all')], channel)).toBe('all')
    expect(
      levelOf([row('workspace', 'w-1', 'all'), row('channel', 'c-1', 'mentions')], channel),
    ).toBe('mentions')
    expect(
      levelOf([row('workspace', 'w-1', 'none'), row('channel', 'c-1', 'inherit')], channel),
    ).toBe('none')
  })

  it('keeps the conversation level independent of any server', () => {
    expect(levelOf([row('conversation', 'd-1', 'none')], conversation)).toBe('none')
    expect(levelOf([row('workspace', 'w-1', 'all')], conversation)).toBe('all')
  })

  it('a running deadline silences the target whatever the level says', () => {
    const until = new Date(now + 60_000)
    expect(levelOf([row('channel', 'c-1', 'all', until)], channel)).toBe('none')
    expect(levelOf([row('workspace', 'w-1', 'all', until)], channel)).toBe('none')
    expect(levelOf([row('conversation', 'd-1', 'all', until)], conversation)).toBe('none')
  })

  it('a passed deadline leaves the level alone', () => {
    expect(levelOf([row('channel', 'c-1', 'all', new Date(now - 60_000))], channel)).toBe('all')
  })

  it('the latest deadline on the way wins, so a server mute covers its channels', () => {
    const rows = [
      row('workspace', 'w-1', 'all', new Date(now + 60_000)),
      row('channel', 'c-1', 'all', new Date(now - 60_000)),
    ]
    expect(levelOf(rows, channel)).toBe('none')
  })
})

describe('isNotificationMuted', () => {
  it('reads an absent row and an absent deadline as not muted', () => {
    expect(isNotificationMuted(undefined, now)).toBe(false)
    expect(isNotificationMuted(row('channel', 'c-1', 'all'), now)).toBe(false)
  })

  it('compares the deadline with now', () => {
    expect(isNotificationMuted(row('channel', 'c-1', 'all', new Date(now + 1)), now)).toBe(true)
    expect(isNotificationMuted(row('channel', 'c-1', 'all', new Date(now)), now)).toBe(false)
  })
})
