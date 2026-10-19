import type { Message } from '@/shared/api'

import { authorName, startsNewGroup } from './message'

const anna = { id: 'u-anna', nickname: 'Anna', isGuest: false, createdAt: new Date() }

function message(fields: Partial<Message> = {}): Message {
  return {
    id: 'm-1',
    channelId: 'c-1',
    seq: 1,
    content: 'привет',
    author: anna,
    mentions: [],
    attachments: [],
    createdAt: new Date('2026-10-18T10:00:00Z'),
    ...fields,
  } as Message
}

it('starts a group for the first message', () => {
  expect(startsNewGroup(message(), undefined)).toBe(true)
})

it('keeps messages of one person within five minutes in one group', () => {
  const previous = message()
  const next = message({ id: 'm-2', createdAt: new Date('2026-10-18T10:04:00Z') })

  expect(startsNewGroup(next, previous)).toBe(false)
})

it('starts a group after a long pause or another author', () => {
  const previous = message()
  const late = message({ id: 'm-2', createdAt: new Date('2026-10-18T10:06:00Z') })
  const other = message({
    id: 'm-3',
    author: { ...anna, id: 'u-bob', nickname: 'Bob' },
    createdAt: new Date('2026-10-18T10:01:00Z'),
  })

  expect(startsNewGroup(late, previous)).toBe(true)
  expect(startsNewGroup(other, previous)).toBe(true)
})

it('names a deleted account instead of showing nothing', () => {
  expect(authorName(message({ author: undefined }))).toBe('Удалённый аккаунт')
})
