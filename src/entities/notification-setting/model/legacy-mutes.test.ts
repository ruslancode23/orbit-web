import { takeLegacyConversationMutes } from './legacy-mutes'

afterEach(() => {
  localStorage.clear()
})

it('returns the dialogues muted on this device and forgets them', () => {
  localStorage.setItem('orbit.notifications.muted-conversations', JSON.stringify(['d-1', 'd-2']))

  expect(takeLegacyConversationMutes()).toEqual(['d-1', 'd-2'])
  expect(localStorage.getItem('orbit.notifications.muted-conversations')).toBeNull()
})

it('survives an empty or broken value', () => {
  expect(takeLegacyConversationMutes()).toEqual([])

  localStorage.setItem('orbit.notifications.muted-conversations', 'not json')
  expect(takeLegacyConversationMutes()).toEqual([])

  localStorage.setItem('orbit.notifications.muted-conversations', JSON.stringify([1, 'd-1']))
  expect(takeLegacyConversationMutes()).toEqual(['d-1'])
})
