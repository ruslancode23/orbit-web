import { characterCount } from '.'

it('counts characters, not UTF-16 units', () => {
  expect(characterCount('Orbit')).toBe(5)
  expect(characterCount('🚀🚀')).toBe(2)
  expect(characterCount('')).toBe(0)
})
