import {
  acknowledgeSecretEnvelope,
  countOneTimeKeys,
  getAttachmentLink,
  getKeyBundle,
  listSecretChats,
  listSecretEnvelopes,
  registerDevice,
  sendSecretEnvelope,
  startSecretChat,
  uploadAttachmentWithProgress,
  uploadOneTimeKeys,
} from '@/shared/api'
import type {
  Attachment,
  Device,
  DeviceRegistration,
  KeyBundle,
  OneTimeKey,
  SecretChat,
  SecretChatStartRequest,
  SecretEnvelope,
  SecretEnvelopeCreate,
} from '@/shared/api'

/**
 * Everything the session needs from orbit-server, in one narrow interface. The
 * protocol tests use a fake implementation of this instead of HTTP, so two
 * "devices" talk to each other in one process.
 */
export interface SecretApi {
  registerDevice: (input: DeviceRegistration) => Promise<Device>
  uploadOneTimeKeys: (deviceId: string, keys: OneTimeKey[]) => Promise<number>
  countOneTimeKeys: (deviceId: string) => Promise<number>
  getKeyBundle: (deviceId: string) => Promise<KeyBundle>
  listSecretChats: (deviceId: string) => Promise<SecretChat[]>
  startSecretChat: (deviceId: string, input: SecretChatStartRequest) => Promise<SecretChat>
  listSecretEnvelopes: (deviceId: string, chatId: string) => Promise<SecretEnvelope[]>
  sendSecretEnvelope: (
    deviceId: string,
    chatId: string,
    input: SecretEnvelopeCreate,
  ) => Promise<SecretEnvelope>
  acknowledgeSecretEnvelope: (deviceId: string, envelopeId: string) => Promise<void>
  uploadFile: (chatId: string, blob: Blob, expiresAt: Date) => Promise<Attachment>
  attachmentLink: (attachmentId: string) => Promise<string>
}

const header = (deviceId: string) => ({ 'X-Orbit-Device': deviceId })

export const serverSecretApi: SecretApi = {
  async registerDevice(input) {
    const { data } = await registerDevice({ body: input })
    return data
  },
  async uploadOneTimeKeys(deviceId, keys) {
    const { data } = await uploadOneTimeKeys({
      path: { deviceId },
      body: { keys: keys.map((key) => ({ keyId: key.keyId, key: key.key })) },
    })
    return data.count
  },
  async countOneTimeKeys(deviceId) {
    const { data } = await countOneTimeKeys({ path: { deviceId } })
    return data.count
  },
  async getKeyBundle(deviceId) {
    const { data } = await getKeyBundle({ path: { deviceId } })
    return data
  },
  async listSecretChats(deviceId) {
    const { data } = await listSecretChats({ headers: header(deviceId) })
    return data
  },
  async startSecretChat(deviceId, input) {
    const { data } = await startSecretChat({ headers: header(deviceId), body: input })
    return data
  },
  async listSecretEnvelopes(deviceId, chatId) {
    const { data } = await listSecretEnvelopes({
      path: { secretChatId: chatId },
      headers: header(deviceId),
    })
    return data
  },
  async sendSecretEnvelope(deviceId, chatId, input) {
    const { data } = await sendSecretEnvelope({
      path: { secretChatId: chatId },
      headers: header(deviceId),
      body: input,
    })
    return data
  },
  async acknowledgeSecretEnvelope(deviceId, envelopeId) {
    await acknowledgeSecretEnvelope({ path: { envelopeId }, headers: header(deviceId) })
  },
  async uploadFile(chatId, blob, expiresAt) {
    const file = new File([blob], 'encrypted.bin', { type: 'application/octet-stream' })
    return uploadAttachmentWithProgress({ channelId: chatId, file, expiresAt })
  },
  async attachmentLink(attachmentId) {
    const { data } = await getAttachmentLink({ path: { attachmentId } })
    return data.url
  },
}
