import { parseSecretEnvelope } from './secret-envelope'

const payload = {
  id: 'envelope-1',
  secretChatId: 'secret-chat-1',
  senderDeviceId: 'peer-device',
  recipientDeviceId: 'device-1',
  type: 0,
  body: 'ciphertext',
  createdAt: '2026-10-20T10:00:00Z',
  expiresAt: '2026-10-21T10:00:00Z',
}

it('accepts the stream payload and turns its dates into Date', () => {
  const parsed = parseSecretEnvelope(payload)

  expect(parsed).not.toBeNull()
  expect(parsed?.id).toBe('envelope-1')
  expect(parsed?.type).toBe(0)
  expect(parsed?.createdAt).toBeInstanceOf(Date)
  expect(parsed?.expiresAt.toISOString()).toBe('2026-10-21T10:00:00.000Z')
})

it('rejects anything that is not an envelope', () => {
  expect(parseSecretEnvelope(null)).toBeNull()
  expect(parseSecretEnvelope({ ...payload, type: 2 })).toBeNull()
  expect(parseSecretEnvelope({ ...payload, body: 42 })).toBeNull()
  expect(parseSecretEnvelope({ ...payload, id: '' })).toBeNull()
  expect(parseSecretEnvelope({ ...payload, expiresAt: 'not a date' })).toBeNull()
})
