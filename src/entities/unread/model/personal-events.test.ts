import { act, renderHook } from '@testing-library/react'

import {
  resetConversationUnread,
  useConversationUnread,
  useConversationUnreadTotal,
} from './conversation-unread'
import { applyPersonalEvent } from './personal-events'

const me = 'u-anna'
const channel = 'c-direct'
const message = (authorId: string, mentioned: boolean) => ({
  type: 'message.created',
  channelId: channel,
  seq: 1,
  payload: {
    id: 'm-1',
    channelId: channel,
    seq: 1,
    content: 'привет',
    mentions: mentioned ? [me] : [],
    author: { id: authorId, nickname: 'Боб' },
  },
})

const context = { userId: me, openChannelId: undefined, viewing: false }

beforeEach(() => {
  resetConversationUnread()
})

it('raises the count for a message in a dialogue that is not being read', () => {
  const { result } = renderHook(() => useConversationUnread(channel))

  act(() => {
    applyPersonalEvent(message('u-bob', true), context)
  })

  expect(result.current).toEqual({ unread: 1, mentions: 1 })
})

it('ignores the messages of this account itself', () => {
  const { result } = renderHook(() => useConversationUnread(channel))

  act(() => {
    applyPersonalEvent(message(me, false), context)
  })

  expect(result.current).toEqual({ unread: 0, mentions: 0 })
})

it('does not count a message in the dialogue on screen in a visible tab', () => {
  const { result } = renderHook(() => useConversationUnread(channel))

  act(() => {
    applyPersonalEvent(message('u-bob', false), {
      ...context,
      openChannelId: channel,
      viewing: true,
    })
  })

  expect(result.current).toEqual({ unread: 0, mentions: 0 })
})

it('counts it while the tab is hidden, because nobody is reading it', () => {
  const { result } = renderHook(() => useConversationUnread(channel))

  act(() => {
    applyPersonalEvent(message('u-bob', false), {
      ...context,
      openChannelId: channel,
      viewing: false,
    })
  })

  expect(result.current.unread).toBe(1)
})

it('takes the exact count from read.changed, as another tab just read it', () => {
  const { result } = renderHook(() => useConversationUnread(channel))

  act(() => {
    applyPersonalEvent(message('u-bob', false), context)
  })
  expect(result.current.unread).toBe(1)

  act(() => {
    applyPersonalEvent(
      {
        type: 'read.changed',
        channelId: channel,
        payload: { channelId: channel, lastReadSeq: 1, unread: 0, mentions: 0 },
      },
      context,
    )
  })

  expect(result.current).toEqual({ unread: 0, mentions: 0 })
})

it('does not count a replayed message twice', () => {
  const { result } = renderHook(() => useConversationUnread(channel))

  act(() => {
    applyPersonalEvent(message('u-bob', false), context)
    applyPersonalEvent(message('u-bob', false), context)
  })

  expect(result.current.unread).toBe(1)
})

it('leaves the unread count of server channels alone', () => {
  const { result } = renderHook(() => useConversationUnreadTotal())

  act(() => {
    applyPersonalEvent(
      { ...message('u-bob', false), workspaceId: 'w-1', channelId: 'channel-1' },
      context,
    )
  })

  expect(result.current).toEqual({ unread: 0, mentions: 0 })
})

it('adds the dialogues up for the rail badge', () => {
  const { result } = renderHook(() => useConversationUnreadTotal())

  act(() => {
    applyPersonalEvent(message('u-bob', true), context)
    applyPersonalEvent({ ...message('u-carol', false), channelId: 'c-other' }, context)
  })

  expect(result.current).toEqual({ unread: 2, mentions: 1 })
})
