import { AVATAR_COLOR_COUNT, avatarColorIndex, initials } from './avatar'

it.each([
  ['Команда Orbit', 'КO'],
  ['  дизайн   и код ', 'ДИ'],
  ['orbit', 'OR'],
  ['я', 'Я'],
  ['🚀 Ракета', '🚀Р'],
  ['👩‍💻 дев', '👩‍💻Д'],
  ['   ', '?'],
])('takes the initials of «%s»', (name, expected) => {
  expect(initials(name)).toBe(expected)
})

it('gives the same key the same colour, within the palette', () => {
  const key = '11111111-1111-4111-8111-111111111111'

  expect(avatarColorIndex(key)).toBe(avatarColorIndex(key))
  const indexes = new Set(
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((item) => avatarColorIndex(item)),
  )
  for (const index of indexes) {
    expect(index).toBeGreaterThanOrEqual(0)
    expect(index).toBeLessThan(AVATAR_COLOR_COUNT)
  }
  // Not everything lands on one colour.
  expect(indexes.size).toBeGreaterThan(1)
})
