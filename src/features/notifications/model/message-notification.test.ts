import {
  incomingMessage,
  notificationBody,
  shouldNotify,
  type IncomingMessage,
  type NotifyContext,
} from './message-notification'

const me = 'u-anna'
const fromBoris: IncomingMessage = {
  channelId: 'c-general',
  content: 'привет',
  mentions: [],
  author: { id: 'u-boris', nickname: 'Boris' },
}
const context: NotifyContext = {
  mode: 'all',
  myId: me,
  openChannelId: 'c-other',
  pageVisible: true,
}

it('notifies about someone else’s message in another channel', () => {
  expect(shouldNotify(fromBoris, context)).toBe(true)
})

it('never notifies about my own message', () => {
  const mine = { ...fromBoris, author: { id: me, nickname: 'Anna' } }
  expect(shouldNotify(mine, context)).toBe(false)
})

it('stays quiet about the channel on screen, but not about a hidden tab', () => {
  expect(shouldNotify(fromBoris, { ...context, openChannelId: 'c-general' })).toBe(false)
  expect(
    shouldNotify(fromBoris, { ...context, openChannelId: 'c-general', pageVisible: false }),
  ).toBe(true)
})

it('follows the mode', () => {
  const mentioned = { ...fromBoris, mentions: [me] }
  expect(shouldNotify(fromBoris, { ...context, mode: 'mentions' })).toBe(false)
  expect(shouldNotify(mentioned, { ...context, mode: 'mentions' })).toBe(true)
  expect(shouldNotify(mentioned, { ...context, mode: 'off' })).toBe(false)
})

it('names the author and shortens a long text', () => {
  expect(notificationBody(fromBoris)).toBe('Boris: привет')
  expect(notificationBody({ ...fromBoris, content: 'а'.repeat(500) })).toHaveLength(
    'Boris: '.length + 140,
  )
})

it('reads only message.created events of the right shape', () => {
  const payload = {
    id: 'm-1',
    channelId: 'c-general',
    seq: 7,
    content: 'привет',
    mentions: [me],
    reactions: [],
    author: { id: 'u-boris', nickname: 'Boris', isGuest: false },
    createdAt: '2026-10-20T10:00:00Z',
  }
  expect(incomingMessage({ type: 'message.created', payload })).toEqual({
    channelId: 'c-general',
    content: 'привет',
    mentions: [me],
    author: { id: 'u-boris', nickname: 'Boris' },
  })
  expect(incomingMessage({ type: 'message.updated', payload })).toBeUndefined()
  expect(incomingMessage({ type: 'message.created', payload: 'oops' })).toBeUndefined()
})
