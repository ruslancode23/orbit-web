import { ApiError } from '@/shared/api'

import { describeWorkspaceError } from './errors'

const refusal = (status: number, message: string) =>
  new ApiError({ status, code: 'invalid_request', message })

it('puts a refusal next to the field it is about', () => {
  expect(
    describeWorkspaceError(refusal(400, 'servers: name must be 1 to 64 characters'), 'x'),
  ).toEqual({
    field: 'name',
    message: 'Название — от 1 до 64 символов.',
  })
  expect(
    describeWorkspaceError(refusal(400, 'servers: description must be at most 500 characters'), 'x')
      .field,
  ).toBe('description')
  expect(describeWorkspaceError(refusal(415, 'the icon must be a PNG'), 'x').field).toBe('icon')
  expect(describeWorkspaceError(refusal(413, 'the icon is larger than allowed'), 'x').field).toBe(
    'icon',
  )
})

it('keeps the rest for the form as a whole', () => {
  expect(
    describeWorkspaceError(new ApiError({ status: 0, code: 'network_error', message: '' }), 'x'),
  ).toEqual({
    message: 'Нет соединения с сервером.',
  })
  expect(describeWorkspaceError(refusal(403, 'forbidden'), 'x')).toEqual({
    message: 'Для этого нужны права администратора.',
  })
  expect(describeWorkspaceError(refusal(500, 'boom'), 'Не вышло.')).toEqual({
    message: 'Не вышло.',
  })
  expect(describeWorkspaceError(new Error('?'), 'Не вышло.')).toEqual({ message: 'Не вышло.' })
})
