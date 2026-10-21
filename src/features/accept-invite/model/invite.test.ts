import { expect, it } from 'vitest'

import { ApiError } from '@/shared/api'

import { describeGuestJoinError } from './invite'

it('says how long to wait when this address made too many accounts', () => {
  const error = new ApiError({
    status: 429,
    code: 'too_many_requests',
    message: 'too many new accounts',
    retryAfterSeconds: 120,
  })
  expect(describeGuestJoinError(error)).toBe(
    'Слишком много новых аккаунтов с этого адреса. Попробуйте снова через 2 мин.',
  )
})
