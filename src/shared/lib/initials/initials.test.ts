import { initials } from './initials'

it.each([
  ['Анна Ли', 'АЛ'],
  ['bob', 'B'],
  ['  Мария  Петровна Иванова ', 'МП'],
  ['😀 smile', '😀S'],
  ['   ', '?'],
])('takes the initials of %j as %j', (name, expected) => {
  expect(initials(name)).toBe(expected)
})
