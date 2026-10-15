import { ApiError } from './api-error'
import { shouldRetry } from './query-client'

describe('shouldRetry', () => {
  const error = (status: number) => new ApiError({ status, code: 'x', message: 'x' })

  it('retries network failures and server errors', () => {
    expect(shouldRetry(0, error(0))).toBe(true)
    expect(shouldRetry(1, error(503))).toBe(true)
  })

  it('does not retry client errors', () => {
    expect(shouldRetry(0, error(400))).toBe(false)
    expect(shouldRetry(0, error(404))).toBe(false)
  })

  it('stops after two retries', () => {
    expect(shouldRetry(2, error(503))).toBe(false)
  })
})
