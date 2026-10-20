import { remainingLabel, remainingRatio, remainingSeconds } from './format'

const createdAt = '2026-10-20T10:00:00Z'
const expiresAt = '2026-10-20T10:00:10Z'

it('counts the seconds left and labels them briefly', () => {
  expect(remainingSeconds(expiresAt, Date.parse(createdAt))).toBe(10)
  expect(remainingSeconds('2026-10-20T10:00:00Z', Date.parse(createdAt))).toBe(0)
  expect(remainingSeconds('not a date')).toBe(0)

  expect(remainingLabel(12)).toBe('12 с')
  expect(remainingLabel(60)).toBe('1 мин')
  expect(remainingLabel(3600)).toBe('1 ч')
  expect(remainingLabel(86_400)).toBe('1 д')
})

it('turns the time left into the share a ring draws', () => {
  expect(remainingRatio(createdAt, expiresAt, Date.parse('2026-10-20T10:00:05Z'))).toBe(0.5)
  expect(remainingRatio(createdAt, expiresAt, Date.parse('2026-10-20T10:00:20Z'))).toBe(0)
  expect(remainingRatio(expiresAt, createdAt)).toBe(0)
})
