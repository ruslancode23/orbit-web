import {
  acceptedFriend,
  friendAcceptedNotification,
  friendRequestNotification,
  incomingFriendRequest,
} from './friend-notification'

const request = {
  type: 'friend.request.created',
  payload: {
    userId: 'u-eva',
    nickname: 'eva',
    direction: 'incoming',
    createdAt: '2026-10-20T10:00:00Z',
  },
}

const accepted = {
  type: 'friend.added',
  payload: {
    id: 'u-bob',
    nickname: 'bob',
    presence: 'online',
    since: '2026-10-20T10:00:00Z',
  },
}

it('reads an incoming request and ignores an outgoing one', () => {
  expect(incomingFriendRequest(request)).toEqual({ id: 'u-eva', nickname: 'eva' })
  expect(
    incomingFriendRequest({
      ...request,
      payload: { ...request.payload, direction: 'outgoing' },
    }),
  ).toBeNull()
  expect(incomingFriendRequest({ type: 'friend.added', payload: accepted.payload })).toBeNull()
})

it('reads only a complete friend.added payload', () => {
  expect(acceptedFriend(accepted)).toEqual({ id: 'u-bob', nickname: 'bob' })
  expect(acceptedFriend({ type: 'friend.added', payload: { id: 'u-bob' } })).toBeNull()
  expect(acceptedFriend({ type: 'friend.removed', payload: accepted.payload })).toBeNull()
})

it('words both notifications and gives each its own tag', () => {
  expect(friendRequestNotification({ id: 'u-eva', nickname: 'eva' })).toEqual({
    title: 'Заявка в друзья',
    body: 'eva хочет добавить вас в друзья',
    tag: 'friend-request-u-eva',
  })
  expect(friendAcceptedNotification({ id: 'u-bob', nickname: 'bob' })).toEqual({
    title: 'Заявка принята',
    body: 'bob теперь у вас в друзьях',
    tag: 'friend-added-u-bob',
  })
})
