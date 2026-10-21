import { ApiError } from '@/shared/api'

import { describeConversationError } from './errors'

const failure = (status: number) => new ApiError({ status, code: 'conflict', message: 'no' })

it('names the way out of a 409 instead of repeating a status code', () => {
  expect(describeConversationError(failure(409))).toBe('Это личный диалог, создайте группу.')
  expect(
    describeConversationError(
      new ApiError({
        status: 409,
        code: 'conflict',
        message: 'conversations: too many people for one group',
      }),
    ),
  ).toBe('В группе уже слишком много участников.')
})

it('explains a lost conversation and a network failure', () => {
  expect(describeConversationError(failure(404))).toContain('Беседа не найдена')
  expect(describeConversationError(failure(0))).toBe('Нет соединения с сервером.')
})

it('falls back to the sentence of the action', () => {
  expect(describeConversationError(new Error('boom'), 'Не получилось.')).toBe('Не получилось.')
})
