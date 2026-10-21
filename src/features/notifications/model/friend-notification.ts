import type { LiveEvent } from '@/entities/live'
import type { PlatformNotification } from '@/shared/platform'

export interface FriendNotificationPerson {
  id: string
  nickname: string
}

const readString = (payload: object, key: string): string | undefined => {
  const descriptor = Object.getOwnPropertyDescriptor(payload, key)
  if (descriptor === undefined) {
    return undefined
  }
  return typeof descriptor.value === 'string' ? descriptor.value : undefined
}

/** The other account of an incoming `friend.request.created`; outgoing ones are silent. */
export const incomingFriendRequest = (event: LiveEvent): FriendNotificationPerson | null => {
  if (event.type !== 'friend.request.created') {
    return null
  }
  const payload = event.payload
  if (typeof payload !== 'object' || payload === null) {
    return null
  }
  if (readString(payload, 'direction') !== 'incoming') {
    return null
  }
  const id = readString(payload, 'userId')
  const nickname = readString(payload, 'nickname')
  if (id === undefined || nickname === undefined) {
    return null
  }
  return { id, nickname }
}

/** The new friend from a `friend.added` event; both sides receive it. */
export const acceptedFriend = (event: LiveEvent): FriendNotificationPerson | null => {
  if (event.type !== 'friend.added') {
    return null
  }
  const payload = event.payload
  if (typeof payload !== 'object' || payload === null) {
    return null
  }
  const id = readString(payload, 'id')
  const nickname = readString(payload, 'nickname')
  if (id === undefined || nickname === undefined) {
    return null
  }
  return { id, nickname }
}

/** «Анна хочет добавить вас в друзья», one notification per request. */
export const friendRequestNotification = (
  person: FriendNotificationPerson,
): PlatformNotification => {
  return {
    title: 'Заявка в друзья',
    body: `${person.nickname} хочет добавить вас в друзья`,
    tag: `friend-request-${person.id}`,
  }
}

/** «Анна теперь у вас в друзьях»: the answer to a request this account sent. */
export const friendAcceptedNotification = (
  person: FriendNotificationPerson,
): PlatformNotification => {
  return {
    title: 'Заявка принята',
    body: `${person.nickname} теперь у вас в друзьях`,
    tag: `friend-added-${person.id}`,
  }
}
