import { describe, expect, it } from 'vitest'

import { ApiError } from '@/shared/api'

import {
  describeBugReportError,
  MAX_SCREENSHOT_BYTES,
  reportRoute,
  reportUserAgent,
  screenshotProblem,
} from './bug-report'

const refusal = (status: number, message = '', retryAfterSeconds?: number) =>
  new ApiError({
    status,
    code: 'invalid_request',
    message,
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  })

describe('reportRoute', () => {
  it.each([
    ['/s/ws-1/ch-2', '/s/ws-1/ch-2'],
    ['/s/ws-1/ch-2?highlight=5#m-9', '/s/ws-1/ch-2'],
    ['/invite/secret-code', '/invite/:code'],
    ['/invite/secret-code/extra', '/invite/:code/extra'],
    ['/me/s/secret-chat-id', '/me/s/:secretChatId'],
    ['/me/conversation-1', '/me/conversation-1'],
    ['/login?next=/invite/abc', '/login'],
  ])('%s → %s', (pathname, route) => {
    expect(reportRoute(pathname)).toBe(route)
  })

  it('keeps the route within the server limit', () => {
    expect(reportRoute(`/${'a'.repeat(600)}`)).toHaveLength(512)
  })
})

it('cuts the browser line to what the server keeps', () => {
  expect(reportUserAgent('x'.repeat(600))).toHaveLength(512)
  expect(reportUserAgent('Mozilla/5.0')).toBe('Mozilla/5.0')
})

describe('screenshotProblem', () => {
  it('takes PNG, JPEG and WebP', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(screenshotProblem(new File(['x'], 'shot', { type }))).toBeUndefined()
    }
  })

  it('refuses other types, empty files and files over the limit', () => {
    expect(screenshotProblem(new File(['x'], 'shot.gif', { type: 'image/gif' }))).toMatch(/PNG/)
    expect(screenshotProblem(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }))).toMatch(
      /PNG/,
    )
    expect(screenshotProblem(new File([], 'empty.png', { type: 'image/png' }))).toBe('Файл пустой.')
    const big = new File([new Uint8Array(MAX_SCREENSHOT_BYTES + 1)], 'big.png', {
      type: 'image/png',
    })
    expect(screenshotProblem(big)).toMatch(/5 МБ/)
  })
})

describe('describeBugReportError', () => {
  it('puts a 400 next to the field the server named', () => {
    expect(describeBugReportError(refusal(400, 'description: describe what went wrong'))).toEqual(
      expect.objectContaining({ field: 'description' }),
    )
    expect(describeBugReportError(refusal(400, 'steps: must not exceed 4000 characters'))).toEqual(
      expect.objectContaining({ field: 'steps' }),
    )
    expect(describeBugReportError(refusal(400, 'screenshot: the file is empty'))).toEqual(
      expect.objectContaining({ field: 'screenshot' }),
    )
  })

  it('reads the field from the schema check too', () => {
    const message =
      'request body has an error: doesn\'t match schema: Error at "/steps": maximum string length is 4000'
    expect(describeBugReportError(refusal(400, message)).field).toBe('steps')
  })

  it('keeps a 400 about the attached context on the form', () => {
    expect(describeBugReportError(refusal(400, 'route: must be a path')).field).toBeUndefined()
  })

  it('puts 413 and 415 on the screenshot', () => {
    expect(describeBugReportError(refusal(413)).field).toBe('screenshot')
    expect(describeBugReportError(refusal(415)).field).toBe('screenshot')
  })

  it('says how long to wait after 429', () => {
    const text = describeBugReportError(refusal(429, 'too many', 1800))
    expect(text.field).toBeUndefined()
    expect(text.message).toMatch(/через 30 мин/)
  })

  it('tells a lost connection apart', () => {
    expect(describeBugReportError(refusal(0)).message).toMatch(/Нет соединения/)
    expect(describeBugReportError(new Error('boom')).message).toMatch(/Не получилось/)
  })
})
