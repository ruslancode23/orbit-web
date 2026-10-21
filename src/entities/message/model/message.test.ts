import type { Message } from '@/shared/api'

import { authorName, startsNewGroup, systemEventText } from './message'

const anna = {
  id: 'u-anna',
  nickname: 'Anna',
  displayName: 'Anna',
  accentColor: 'slate' as const,
  bio: '',
  isGuest: false,
  createdAt: new Date(),
}

function message(fields: Partial<Message> = {}): Message {
  return {
    id: 'm-1',
    channelId: 'c-1',
    seq: 1,
    kind: 'user',
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

it('starts a new group for a system line in either direction', () => {
  const system = message({ id: 'm-sys', kind: 'system', system: { type: 'member_removed' } })
  expect(startsNewGroup(system, message())).toBe(true)
  expect(startsNewGroup(message({ id: 'm-2' }), system)).toBe(true)
})

it('names a deleted account instead of showing nothing', () => {
  expect(authorName(message({ author: undefined }))).toBe('Удалённый аккаунт')
})

it('describes a system event without reading its fallback text', () => {
  const people = [
    { id: 'u-anna', nickname: 'anna', displayName: 'Анна' },
    { id: 'u-bob', nickname: 'bob', displayName: 'Боб' },
  ]
  expect(
    systemEventText(
      {
        kind: 'system',
        author: { nickname: 'anna', displayName: 'Анна' },
        system: { type: 'member_added', targetId: 'u-bob' },
        content: 'не использовать',
      },
      people,
    ),
  ).toBe('Анна добавил Боб')
  expect(
    systemEventText({
      kind: 'system',
      author: { nickname: 'anna', displayName: 'Анна' },
      system: { type: 'conversation_renamed', name: 'Планы' },
      content: 'не использовать',
    }),
  ).toBe('Анна переименовал чат в «Планы»')
  expect(systemEventText(message())).toBeUndefined()
})
