import type { SecretEnvelope } from '@/shared/api'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const isString = (value: unknown): value is string => {
  return typeof value === 'string' && value !== ''
}

const isEnvelopeType = (value: unknown): value is 0 | 1 => {
  return value === 0 || value === 1
}

/** The stream sends dates as strings; the generated type says `Date`. */
const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value !== 'string') {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * A live event is untrusted JSON, so the envelope is rebuilt field by field
 * instead of asserted into shape. Anything missing keeps the message out.
 */
export const parseSecretEnvelope = (value: unknown): SecretEnvelope | null => {
  if (!isRecord(value)) {
    return null
  }
  const { id, secretChatId, senderDeviceId, recipientDeviceId, type, body } = value
  const createdAt = toDate(value.createdAt)
  const expiresAt = toDate(value.expiresAt)
  if (
    !isString(id) ||
    !isString(secretChatId) ||
    !isString(senderDeviceId) ||
    !isString(recipientDeviceId) ||
    !isEnvelopeType(type) ||
    !isString(body) ||
    createdAt === null ||
    expiresAt === null
  ) {
    return null
  }
  return {
    id,
    secretChatId,
    senderDeviceId,
    recipientDeviceId,
    type,
    body,
    createdAt,
    expiresAt,
  }
}
