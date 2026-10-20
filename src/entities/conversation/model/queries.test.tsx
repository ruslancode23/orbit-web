import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'

import { getConversationQueryKey, type Conversation } from '@/shared/api'

import {
  conversationMembersExcept,
  conversationName,
  conversationPeer,
  useConversation,
  useConversationSummaries,
  useConversations,
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
  members: [anna, bob, carol],
  createdAt: new Date('2026-10-20T11:00:00Z'),
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

interface ApiState {
  conversations: Conversation[]
  lastMessages: Record<string, unknown[]>
  posted: string[]
  listReads: number
  detailReads: number
}

const latestMessage = (id: string, channelId: string, createdAt: string) => {
  return {
    id,
    channelId,
    seq: 1,
    content: 'привет',
    mentions: [],
    reactions: [],
    createdAt: new Date(createdAt),
  }
}

/** Answers the conversation endpoints and records what was asked for. */
const stubApi = (overrides: Partial<ApiState> = {}): ApiState => {
  const state: ApiState = {
    conversations: [direct, group],
    lastMessages: {},
    posted: [],
    listReads: 0,
    detailReads: 0,
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
        return json(state.conversations)
      }
      if (url.pathname.startsWith('/api/v1/conversations/')) {
        state.detailReads += 1
        const id = url.pathname.slice(url.pathname.lastIndexOf('/') + 1)
        const found = state.conversations.find((item) => item.id === id)
        return found ? json(found) : json({ error: { code: 'not_found', message: 'gone' } }, 404)
      }
      const channel = /^\/api\/v1\/channels\/([^/]+)\/messages$/u.exec(url.pathname)?.[1]
      if (channel !== undefined) {
        return json({ messages: state.lastMessages[channel] ?? [] })
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

  it('joins the other members for a group', () => {
    expect(conversationName(group, anna.id)).toBe('Боб, Кэрол')
  })

  it('falls back to neutral words when there is nobody else', () => {
    const alone: Conversation = {
      ...direct,
      members: [anna],
    }
    expect(conversationName(alone, anna.id)).toBe('Диалог')
    expect(conversationName({ ...group, members: [anna] }, anna.id)).toBe('Групповой чат')
  })
})

describe('useConversations', () => {
  it('returns the conversations in the order the server sent them', async () => {
    stubApi()
    const { result } = renderQuery(() => useConversations())

    await waitFor(() => {
      expect(result.current.data?.map((conversation) => conversation.id)).toEqual([
        'c-direct',
        'c-group',
      ])
    })
    expect(result.current.data?.[0]?.createdAt).toBeInstanceOf(Date)
  })
})

describe('useConversationSummaries', () => {
  it('reads the latest message of every dialogue and orders by it', async () => {
    stubApi({
      conversations: [group, direct],
      lastMessages: {
        'c-direct': [latestMessage('m-direct', 'c-direct', '2026-10-20T13:00:00Z')],
        'c-group': [latestMessage('m-group', 'c-group', '2026-10-20T12:00:00Z')],
      },
    })
    const { result } = renderQuery(() => useConversationSummaries())

    await waitFor(() => {
      expect(result.current.summaries.map((item) => item.conversation.id)).toEqual([
        'c-direct',
        'c-group',
      ])
    })
    expect(result.current.summaries[0]?.lastMessage?.content).toBe('привет')
    expect(result.current.isPending).toBe(false)
  })

  it('falls back to the creation moment for a dialogue without messages', async () => {
    stubApi({ conversations: [group, direct], lastMessages: {} })
    const { result } = renderQuery(() => useConversationSummaries())

    await waitFor(() => {
      expect(result.current.summaries).toHaveLength(2)
    })
    // The group was created later, so it stands first while both are empty.
    expect(result.current.summaries.map((item) => item.conversation.id)).toEqual([
      'c-group',
      'c-direct',
    ])
    expect(result.current.summaries[0]?.lastMessage).toBeUndefined()
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
      () => ({ conversations: useConversations(), start: useStartConversation() }),
      queryClient,
    )

    await waitFor(() => {
      expect(result.current.conversations.data).toHaveLength(2)
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
