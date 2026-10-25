import type { MessageSearchHit } from '@/shared/api'

import { searchHitHref, searchHitPlace, splitHeadline } from './search'

const hit = (overrides: Partial<MessageSearchHit> = {}): MessageSearchHit => ({
  message: {
    id: 'm-1',
    channelId: 'c-1',
    seq: 42n,
    kind: 'user',
    content: 'привет',
    mentions: [],
    reactions: [],
    attachments: [],
    createdAt: new Date('2026-10-24T10:00:00Z'),
  },
  headline: 'привет',
  channelName: 'общий',
  workspaceId: 'w-1',
  ...overrides,
})

describe('splitHeadline', () => {
  it('keeps plain text as one part', () => {
    expect(splitHeadline('просто текст')).toEqual([{ text: 'просто текст', highlighted: false }])
  })

  it('marks the words the server wrapped in the control characters', () => {
    expect(splitHeadline('до \u0002слово\u0003 после')).toEqual([
      { text: 'до ', highlighted: false },
      { text: 'слово', highlighted: true },
      { text: ' после', highlighted: false },
    ])
  })

  it('shows an unterminated marker as text instead of dropping the rest', () => {
    expect(splitHeadline('до \u0002слово')).toEqual([
      { text: 'до ', highlighted: false },
      { text: '\u0002слово', highlighted: false },
    ])
  })
})

describe('searchHitHref', () => {
  it('leads to the server channel at the message', () => {
    expect(searchHitHref(hit())).toBe('/s/w-1/c-1?at=42')
  })

  it('leads to the dialogue when there is no server', () => {
    expect(searchHitHref(hit({ workspaceId: null, channelName: null }))).toBe('/me/c-1?at=42')
  })
})

describe('searchHitPlace', () => {
  it('names a server channel with a hash and a group by its title', () => {
    expect(searchHitPlace(hit())).toBe('# общий')
    expect(searchHitPlace(hit({ workspaceId: null, channelName: 'Планы' }))).toBe('Планы')
  })

  it('falls back to the words of a pair dialogue', () => {
    expect(searchHitPlace(hit({ workspaceId: null, channelName: null }))).toBe('Личное сообщение')
  })
})
