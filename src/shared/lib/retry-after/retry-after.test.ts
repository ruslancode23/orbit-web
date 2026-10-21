import { describe, expect, it } from 'vitest'

import { describeRetryAfter } from '.'

describe('describeRetryAfter', () => {
  it('rounds minutes up and names seconds in Russian', () => {
    expect(describeRetryAfter(360)).toBe('Попробуйте снова через 6 мин.')
    expect(describeRetryAfter(61)).toBe('Попробуйте снова через 2 мин.')
    expect(describeRetryAfter(1)).toBe('Попробуйте снова через 1 секунду.')
    expect(describeRetryAfter(3)).toBe('Попробуйте снова через 3 секунды.')
    expect(describeRetryAfter(45)).toBe('Попробуйте снова через 45 секунд.')
  })

  it('asks to try later when the server named no wait', () => {
    expect(describeRetryAfter(undefined)).toBe('Попробуйте позже.')
  })
})
