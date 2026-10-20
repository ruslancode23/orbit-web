import type { Friend, PresenceStatus } from '@/shared/api'

import { describeIncomingRequests, formatFriendDate, isFriendOnline } from './friend'

const friend = (presence: PresenceStatus): Friend => ({
  id: 'u-anna',
  nickname: 'anna',
  presence,
  since: new Date('2026-10-20T10:00:00Z'),
})

it('counts online, idle and do-not-disturb as reachable and offline as not', () => {
  expect(isFriendOnline(friend('online'))).toBe(true)
  expect(isFriendOnline(friend('idle'))).toBe(true)
  expect(isFriendOnline(friend('dnd'))).toBe(true)
  expect(isFriendOnline(friend('offline'))).toBe(false)
})

it('says how many requests are waiting in Russian', () => {
  expect(describeIncomingRequests(1)).toBe('1 входящая заявка')
  expect(describeIncomingRequests(2)).toBe('2 входящие заявки')
  expect(describeIncomingRequests(5)).toBe('5 входящих заявок')
})

it('draws a short day for a request or a block', () => {
  expect(formatFriendDate(new Date('2026-10-20T12:00:00Z'))).toBe('20 октября')
})
