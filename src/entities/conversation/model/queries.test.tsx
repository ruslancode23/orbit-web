import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'

import {
  getConversationQueryKey,
  type Conversation,
  type ConversationPage,
  type ConversationSummary,
} from '@/shared/api'

import {
  conversationMembersExcept,
  conversationName,
  conversationPeer,
  useConversation,
  useConversationSummaries,
  useStartConversation,
} from './queries'

import type { ReactNode } from 'react'

const anna = {
  id: 'u-anna',
  nickname: 'Анна',
  displayName: 'Анна',
  accentColor: 'slate' as const,
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-01-01T10:00:00Z'),
  joinedAt: new Date('2026-10-20T10:00:00Z'),
}
const bob = {
  id: 'u-bob',
  nickname: 'Боб',
  displayName: 'Боб',
  accentColor: 'slate' as const,
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-01-01T10:00:00Z'),
  joinedAt: new Date('2026-10-20T10:00:00Z'),
}
const carol = {
  id: 'u-carol',
  nickname: 'Кэрол',
  displayName: 'Кэрол',
  accentColor: 'slate' as const,
  bio: '',
  isGuest: false,
  createdAt: new Date('2026-01-01T10:00:00Z'),
  joinedAt: new Date('2026-10-20T10:00:00Z'),
}

const direct: Conversation = {
  id: 'c-direct',
  kind: 'direct',
  members: [anna, bob],
  createdAt: new Date('2026-10-20T10:00:00Z'),
}
const group: Conversation = {
  id: 'c-group',
  kind: 'group',
  name: 'Планы',
  members: [anna, bob, carol],
  createdAt: new Date('2026-10-20T11:00:00Z'),
}

const directSummary: ConversationSummary = {
  id: 'c-direct',
  kind: 'direct',
  members: [anna, bob],
  createdAt: new Date('2026-10-20T10:00:00Z'),
  lastMessage: {
    id: 'm-direct',
    seq: 1n,
    kind: 'user',
    author: bob,
    content: 'привет',
    createdAt: new Date('2026-10-20T13:00:00Z'),
  },
  lastReadSeq: 0n,
  unread: 2,
  mentions: 1,
}
const groupSummary: ConversationSummary = {
  id: 'c-group',
  kind: 'group',
  name: 'Планы',
  members: [anna, bob, carol],
  createdAt: new Date('2026-10-20T11:00:00Z'),
  lastMessage: {
    id: 'm-group',
    seq: 4n,
    kind: 'user',
    author: carol,
    content: 'как дела',
    createdAt: new Date('2026-10-20T12:00:00Z'),
  },
  lastReadSeq: 3n,
  unread: 0,
  mentions: 0,
}

const json = (body: unknown, status = 200) => {
  return new Response(
    JSON.stringify(body, (_key, value: unknown) =>
      typeof value === 'bigint' ? Number(value) : value,
    ),
    { status, headers: { 'Content-Type': 'application/json' } },
  )
}

interface ApiState {
  pages: Record<string, ConversationPage>
  details: Record<string, Conversation>
  listCursors: (string | null)[]
  listReads: number
  detailReads: number
  historyReads: number
  posted: string[]
}

/** Answers the conversation endpoints and records what was asked for. */
const stubApi = (overrides: Partial<ApiState> = {}): ApiState => {
  const state: ApiState = {
    pages: { '': { conversations: [directSummary, groupSummary] } },
    details: { [direct.id]: direct, [group.id]: group },
    listCursors: [],
    listReads: 0,
    detailReads: 0,
    historyReads: 0,
    posted: [],
    ...overrides,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const request = input as Request
      const url = new URL(request.url)
      if (url.pathname === '/api/v1/conversations') {
        if (request.method === 'POST') {
          state.posted.push(await request.clone().text())
          return json(direct)
        }
        state.listReads += 1
        const cursor = url.searchParams.get('cursor')
        state.listCursors.push(cursor)
        const page = state.pages[cursor ?? '']
        if (!page) {
          return json({ error: { code: 'invalid_cursor', message: 'no' } }, 400)
        }
        return json(page)
      }
      if (url.pathname === '/api/v1/conversations/unread') {
        return json({ unread: 2, mentions: 1 })
      }
      if (url.pathname.startsWith('/api/v1/conversations/')) {
        state.detailReads += 1
        const id = url.pathname.slice(url.pathname.lastIndexOf('/') + 1)
        const found = state.details[id]
        return found ? json(found) : json({ error: { code: 'not_found', message: 'gone' } }, 404)
      }
      if (url.pathname.includes('/messages')) {
        state.historyReads += 1
        return json({ messages: [] })
      }
      return json({})
    }),
  )
  return state
}

const wrapperFor = (queryClient: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const renderQuery = <T,>(callback: () => T, queryClient = new QueryClient()) => {
  return renderHook(callback, { wrapper: wrapperFor(queryClient) })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('conversationPeer', () => {
  it('finds the other person of a pair from either side', () => {
    expect(conversationPeer(direct, anna.id)).toEqual(bob)
    expect(conversationPeer(direct, bob.id)).toEqual(anna)
  })

  it('has no single peer in a group', () => {
    expect(conversationPeer(group, anna.id)).toBeUndefined()
  })

  it('lists everybody but the reader', () => {
    expect(conversationMembersExcept(group, anna.id)).toEqual([bob, carol])
  })
})

describe('conversationName', () => {
  it('names a pair by the person on the other side', () => {
    expect(conversationName(direct, anna.id)).toBe('Боб')
    expect(conversationName(direct, bob.id)).toBe('Анна')
  })

  it('takes the group title from the server instead of joining members', () => {
    expect(conversationName(group, anna.id)).toBe('Планы')
    expect(conversationName(groupSummary, anna.id)).toBe('Планы')
  })

  it('stays neutral for a group without a title', () => {
    const unnamed: Conversation = { ...group, name: undefined }
    expect(conversationName(unnamed, anna.id)).toBe('Групповой чат')
  })

  it('falls back to neutral words when a pair has nobody else', () => {
    const alone: Conversation = { ...direct, members: [anna] }
    expect(conversationName(alone, anna.id)).toBe('Диалог')
  })
})

describe('useConversationSummaries', () => {
  it('reads previews and unread counts from the list, without asking for history', async () => {
    const state = stubApi()
    const { result } = renderQuery(() => useConversationSummaries())

    await waitFor(() => {
      expect(result.current.summaries.map((summary) => summary.id)).toEqual(['c-direct', 'c-group'])
    })
    expect(result.current.summaries[0]?.lastMessage?.content).toBe('привет')
    expect(result.current.summaries[0]?.unread).toBe(2)
    expect(result.current.summaries[0]?.mentions).toBe(1)
    expect(result.current.summaries[1]?.name).toBe('Планы')
    expect(result.current.isPending).toBe(false)
    // The old contract read one history page per dialogue for the preview.
    expect(state.historyReads).toBe(0)
  })

  it('asks for the next page by the cursor the server returned', async () => {
    const state = stubApi({
      pages: {
        '': { conversations: [directSummary], nextCursor: 'page-2' },
        'page-2': { conversations: [groupSummary] },
      },
    })
    const { result } = renderQuery(() => useConversationSummaries())

    await waitFor(() => {
      expect(result.current.summaries).toHaveLength(1)
    })
    expect(result.current.hasNextPage).toBe(true)

    await act(async () => {
      await result.current.fetchNextPage()
    })

    await waitFor(() => {
      expect(result.current.summaries.map((summary) => summary.id)).toEqual(['c-direct', 'c-group'])
    })
    expect(state.listCursors).toEqual([null, 'page-2'])
    expect(result.current.hasNextPage).toBe(false)
  })

  it('passes the page size to the server', async () => {
    stubApi()
    renderQuery(() => useConversationSummaries())

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalled()
    })
    const call = vi.mocked(fetch).mock.calls[0]?.[0]
    const url = new URL(call instanceof Request ? call.url : String(call))
    expect(url.searchParams.get('limit')).toBe('20')
  })
})

describe('useConversation', () => {
  it('does not ask for a conversation without an id', async () => {
    const state = stubApi()
    const { result } = renderQuery(() => useConversation(undefined))

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(result.current.isPending).toBe(true)
    expect(state.detailReads).toBe(0)
  })

  it('reads one conversation by id', async () => {
    const state = stubApi()
    const { result } = renderQuery(() => useConversation(direct.id))

    await waitFor(() => {
      expect(result.current.data?.id).toBe(direct.id)
    })
    expect(state.detailReads).toBe(1)
  })
})

describe('useStartConversation', () => {
  it('opens or finds the pair, caches it and refreshes the list', async () => {
    const state = stubApi()
    const queryClient = new QueryClient()
    const { result } = renderQuery(
      () => ({ list: useConversationSummaries(), start: useStartConversation() }),
      queryClient,
    )

    await waitFor(() => {
      expect(result.current.list.summaries).toHaveLength(2)
    })

    act(() => {
      result.current.start.mutate({ body: { userIds: [bob.id] } })
    })

    await waitFor(() => {
      expect(result.current.start.data?.id).toBe(direct.id)
    })
    expect(state.posted).toEqual([JSON.stringify({ userIds: [bob.id] })])
    expect(
      queryClient.getQueryData(getConversationQueryKey({ path: { conversationId: direct.id } })),
    ).toEqual(direct)
    await waitFor(() => {
      expect(state.listReads).toBeGreaterThan(1)
    })
  })
})
