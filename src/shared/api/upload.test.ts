import { FakeXhr } from '@/shared/lib/test'

import { ApiError } from './api-error'
import { uploadAttachmentWithProgress } from './upload'

const stored = {
  id: 'a-1',
  fileName: 'cat.png',
  mimeType: 'image/png',
  sizeBytes: 2048,
  width: 640,
  height: 480,
  createdAt: '2026-10-20T10:00:00Z',
}

beforeEach(() => {
  FakeXhr.instances = []
  vi.stubGlobal('XMLHttpRequest', FakeXhr)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const file = () => new File(['png'], 'cat.png', { type: 'image/png' })

it('sends the file with the session cookie and reports progress', async () => {
  const onProgress = vi.fn()
  const upload = uploadAttachmentWithProgress({ channelId: 'c-1', file: file(), onProgress })

  const request = FakeXhr.last()
  expect(request.method).toBe('POST')
  expect(request.url).toBe('http://localhost:8080/api/v1/channels/c-1/attachments')
  expect(request.withCredentials).toBe(true)
  expect(request.file?.name).toBe('cat.png')

  request.progress(512, 2048)
  expect(onProgress).toHaveBeenCalledWith({ loaded: 512, total: 2048 })

  request.respond(201, stored)
  await expect(upload).resolves.toEqual({
    ...stored,
    sizeBytes: 2048n,
    createdAt: new Date('2026-10-20T10:00:00Z'),
  })
})

it('rejects with the server error as ApiError', async () => {
  const upload = uploadAttachmentWithProgress({ channelId: 'c-1', file: file() })
  FakeXhr.last().respond(413, { error: { code: 'too_large', message: 'The file is too large' } })

  const error: unknown = await upload.catch((reason: unknown) => reason)
  expect(error).toBeInstanceOf(ApiError)
  expect(error).toMatchObject({ status: 413, code: 'too_large' })
})

it('reports a lost connection as a network error', async () => {
  const upload = uploadAttachmentWithProgress({ channelId: 'c-1', file: file() })
  FakeXhr.last().failNetwork()

  await expect(upload).rejects.toMatchObject({ status: 0, isNetworkError: true })
})

it('stops the transfer when cancelled', async () => {
  const controller = new AbortController()
  const upload = uploadAttachmentWithProgress({
    channelId: 'c-1',
    file: file(),
    signal: controller.signal,
  })

  controller.abort()

  expect(FakeXhr.last().aborted).toBe(true)
  await expect(upload).rejects.toMatchObject({ name: 'AbortError' })
})
