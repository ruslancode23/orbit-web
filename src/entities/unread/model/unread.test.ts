import { describeUnread, totalUnread } from './unread'

const entry = (unread: number, mentions: number) => ({
  channelId: crypto.randomUUID(),
  lastReadSeq: 0n,
  unread,
  mentions,
})

it('adds up a server from its channels', () => {
  expect(totalUnread([entry(3, 1), entry(2, 0)])).toEqual({ unread: 5, mentions: 1 })
  expect(totalUnread(undefined)).toEqual({ unread: 0, mentions: 0 })
})

it('describes counts in words, mentions apart', () => {
  expect(describeUnread({ unread: 1, mentions: 0 })).toBe('1 непрочитанное')
  expect(describeUnread({ unread: 5, mentions: 2 })).toBe('5 непрочитанных, 2 упоминания')
  expect(describeUnread({ unread: 0, mentions: 0 })).toBe('')
})
