import type { SecretChat, SecretEnvelope } from '@/shared/api'
import {
  calculateSafetyNumber,
  createWorkerEngine,
  decryptFile,
  encryptFile,
  type EncryptedFileMeta,
  type OlmEngine,
  type OlmIdentity,
  type SafetyNumber,
} from '@/shared/crypto'
import { base64ToBytes, bytesToBase64 } from '@/shared/lib/base64'
import { readSecretDevice, SECRET_SCOPE, type StoredSecretDevice } from '@/shared/lib/secret-device'
import type { PlatformSecretStore } from '@/shared/platform'

import type { SecretApi } from './api'

/** Timer options the UI offers, in seconds; 0 means off. */
export const SECRET_TIMERS = [0, 5, 30, 60, 3600, 86_400, 604_800] as const
export type SecretTimer = (typeof SECRET_TIMERS)[number]

const timers: readonly number[] = SECRET_TIMERS
/** The undelivered copy on the server lives at least this long, at most a week. */
const MIN_ENVELOPE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_ENVELOPE_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** Below this supply the device publishes a new batch of pre-keys. */
const PREKEY_LOW_WATER = 20
const PREKEY_BATCH = 50
const PREKEY_INITIAL = 100

const accountScope = SECRET_SCOPE
const chatScope = 'secret-chat'
const messagesScope = 'secret-messages'

interface Sealed {
  iv: string
  data: string
}

interface SecretChatState {
  chat: SecretChat
  /** Recomputed locally on open, never stored. */
  safetyNumber: SafetyNumber
  /** The Olm session pickle, sealed; absent until the first message. */
  session?: Sealed
  verified: boolean
  verifiedDigits?: string
  keyChanged: boolean
  timerSeconds: number
  /** Which peer keys the chat was opened with, to notice a substitution. */
  peerKeys: string
}

export interface SecretFile {
  name: string
  mimeType: string
  size: number
  blob: Blob
}

export interface SecretMessage {
  id: string
  author: 'me' | 'peer' | 'system'
  kind: 'text' | 'file' | 'timer' | 'error'
  text: string
  file?: SecretFile
  createdAt: string
  /** When the timer removes it; absent when the timer is off. */
  expiresAt?: string
}

export interface SecretChatView {
  chat: SecretChat
  messages: SecretMessage[]
  verified: boolean
  verifiedDigits?: string
  keyChanged: boolean
  timerSeconds: number
  safetyNumber: SafetyNumber
}

interface SecretPayload {
  v: 1
  kind: 'text' | 'file' | 'timer'
  text: string
  sentAt: string
  timerSeconds: number
  file?: { attachmentId: string; meta: EncryptedFileMeta }
}

/** A message the chat itself shows; never sent to the server in the clear. */
const systemMessage = (kind: SecretMessage['kind'], text: string): SecretMessage => ({
  id: crypto.randomUUID(),
  author: 'system',
  kind,
  text,
  createdAt: new Date().toISOString(),
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isTimer = (value: unknown): value is SecretTimer =>
  typeof value === 'number' && timers.includes(value)

const isString = (value: unknown): value is string => typeof value === 'string'

const parsePayload = (raw: string): SecretPayload | null => {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed) || parsed.v !== 1) {
    return null
  }
  const { kind, text, sentAt, timerSeconds, file } = parsed
  if (kind !== 'text' && kind !== 'file' && kind !== 'timer') {
    return null
  }
  if (!isString(text) || !isString(sentAt) || !isTimer(timerSeconds)) {
    return null
  }
  const payload: SecretPayload = { v: 1, kind, text, sentAt, timerSeconds }
  if (kind === 'file') {
    if (!isRecord(file) || !isString(file.attachmentId) || !isRecord(file.meta)) {
      return null
    }
    const meta = file.meta
    if (
      !isString(meta.key) ||
      !isString(meta.iv) ||
      !isString(meta.name) ||
      !isString(meta.mimeType) ||
      typeof meta.size !== 'number'
    ) {
      return null
    }
    payload.file = {
      attachmentId: file.attachmentId,
      meta: {
        key: meta.key,
        iv: meta.iv,
        name: meta.name,
        mimeType: meta.mimeType,
        size: meta.size,
      },
    }
  }
  return payload
}

const envelopeTTL = (timerSeconds: number): Date => {
  const desired = timerSeconds > 0 ? timerSeconds * 1000 : MIN_ENVELOPE_TTL_MS
  const bounded = Math.min(Math.max(desired, MIN_ENVELOPE_TTL_MS), MAX_ENVELOPE_TTL_MS)
  return new Date(Date.now() + bounded)
}

const sealWith = async (key: CryptoKey, plain: string): Promise<Sealed> => {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain),
  )
  return { iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(ciphertext)) }
}

const openWith = async (key: CryptoKey, sealed: Sealed): Promise<string> => {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(sealed.iv) },
    key,
    base64ToBytes(sealed.data),
  )
  return new TextDecoder().decode(plaintext)
}

/**
 * One browser's secret chats: its Olm account, one session per chat, and the
 * decrypted history on this device only. Nothing here touches the network
 * except through `SecretApi`, so tests can run two devices in one process.
 */
export class SecretSession {
  private readonly states = new Map<string, SecretChatState>()
  private readonly messages = new Map<string, SecretMessage[]>()
  private readonly wrapKey: CryptoKey
  private readonly api: SecretApi
  private readonly store: PlatformSecretStore
  private readonly engine: OlmEngine
  private identity: OlmIdentity
  private device: StoredSecretDevice

  private constructor(
    api: SecretApi,
    store: PlatformSecretStore,
    engine: OlmEngine,
    identity: OlmIdentity,
    device: StoredSecretDevice,
    wrapKey: CryptoKey,
  ) {
    this.api = api
    this.store = store
    this.engine = engine
    this.identity = identity
    this.device = device
    this.wrapKey = wrapKey
  }

  /**
   * Loads this browser's account, registering the device on first use. A device
   * that the server forgot (revoked elsewhere) is recreated: the old chats are
   * gone with their keys, and the peer sees a new device.
   */
  static async open(
    api: SecretApi,
    store: PlatformSecretStore,
    userId: string,
    deviceName: string,
    engine: OlmEngine = createWorkerEngine(),
  ): Promise<SecretSession> {
    const wrapKey = await ensureWrapKey(store)
    const stored = await readSecretDevice(store)
    const sealed = await store.get<Sealed>(accountScope, 'account', null)

    if (stored && sealed) {
      await engine.unpickleAccount(await openWith(wrapKey, sealed))
      const session = new SecretSession(
        api,
        store,
        engine,
        await engine.identity(),
        stored,
        wrapKey,
      )
      await session.refillPreKeys().catch(() => undefined)
      return session
    }

    await engine.createAccount()
    const identity = await engine.identity()
    const signature = await engine.sign(
      `orbit-device-v1|${userId}|${identity.identityKey}|${identity.signingKey}`,
    )
    const device = await api.registerDevice({
      name: deviceName,
      identityKey: identity.identityKey,
      signingKey: identity.signingKey,
      signature,
    })
    const storedDevice: StoredSecretDevice = {
      deviceId: device.id,
      userId: device.userId,
      name: device.name,
      identityKey: identity.identityKey,
      signingKey: identity.signingKey,
    }
    await store.set(accountScope, 'device', storedDevice)

    const session = new SecretSession(api, store, engine, identity, storedDevice, wrapKey)
    await session.persistAccount()
    await session.publishPreKeys(PREKEY_INITIAL)
    return session
  }

  get currentDevice(): StoredSecretDevice {
    return this.device
  }

  /** The identity keys of this device, for the safety number. */
  get currentIdentity(): OlmIdentity {
    return this.identity
  }

  async listChats(): Promise<SecretChat[]> {
    return this.api.listSecretChats(this.device.deviceId)
  }

  async startChat(peerUserId: string, peerDeviceId?: string): Promise<SecretChat> {
    return this.api.startSecretChat(this.device.deviceId, {
      userId: peerUserId,
      ...(peerDeviceId ? { peerDeviceId } : {}),
    })
  }

  /**
   * Opens a chat: reads the local state, notices a changed peer key, and drains
   * the envelopes that were waiting for this device.
   */
  async openChat(chat: SecretChat): Promise<SecretChatView> {
    await this.loadState(chat)
    await this.loadMessages(chat.id)
    await this.drain(chat.id)
    return this.view(chat.id)
  }

  async refresh(chatId: string): Promise<SecretChatView> {
    await this.drain(chatId)
    return this.view(chatId)
  }

  view(chatId: string): SecretChatView {
    const state = this.states.get(chatId)
    if (!state) {
      throw new Error('secret chat is not open')
    }
    const messages = [...(this.messages.get(chatId) ?? [])].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )
    return {
      chat: state.chat,
      messages: messages.filter((message) => !isExpired(message)),
      verified: state.verified,
      ...(state.verifiedDigits === undefined ? {} : { verifiedDigits: state.verifiedDigits }),
      keyChanged: state.keyChanged,
      timerSeconds: state.timerSeconds,
      safetyNumber: state.safetyNumber,
    }
  }

  async sendText(chat: SecretChat, text: string): Promise<SecretMessage> {
    const state = await this.loadState(chat)
    const trimmed = text.trim()
    if (!trimmed) {
      throw new Error('Сообщение пустое')
    }
    const payload: SecretPayload = {
      v: 1,
      kind: 'text',
      text: trimmed,
      sentAt: new Date().toISOString(),
      timerSeconds: state.timerSeconds,
    }
    await this.sendPayload(state, payload)
    const message = await this.appendMessage(state.chat.id, {
      id: crypto.randomUUID(),
      author: 'me',
      kind: 'text',
      text: trimmed,
      createdAt: payload.sentAt,
      ...(state.timerSeconds > 0
        ? {
            expiresAt: new Date(
              Date.parse(payload.sentAt) + state.timerSeconds * 1000,
            ).toISOString(),
          }
        : {}),
    })
    return message
  }

  async sendFile(chat: SecretChat, file: File): Promise<SecretMessage> {
    const state = await this.loadState(chat)
    const encrypted = await encryptFile(file)
    const expiresAt = envelopeTTL(state.timerSeconds)
    const attachment = await this.api.uploadFile(chat.id, encrypted.blob, expiresAt)
    const payload: SecretPayload = {
      v: 1,
      kind: 'file',
      text: '',
      sentAt: new Date().toISOString(),
      timerSeconds: state.timerSeconds,
      file: { attachmentId: attachment.id, meta: encrypted.meta },
    }
    await this.sendPayload(state, payload)
    return this.appendMessage(chat.id, {
      id: crypto.randomUUID(),
      author: 'me',
      kind: 'file',
      text: payload.text,
      file: {
        name: encrypted.meta.name,
        mimeType: encrypted.meta.mimeType,
        size: encrypted.meta.size,
        blob: file,
      },
      createdAt: payload.sentAt,
      ...(state.timerSeconds > 0
        ? {
            expiresAt: new Date(
              Date.parse(payload.sentAt) + state.timerSeconds * 1000,
            ).toISOString(),
          }
        : {}),
    })
  }

  /** A timer change is itself a message: the peer must learn about it. */
  async setTimer(chat: SecretChat, seconds: SecretTimer): Promise<void> {
    const state = await this.loadState(chat)
    if (state.timerSeconds === seconds) {
      return
    }
    state.timerSeconds = seconds
    await this.saveState(state)
    const label = timerLabel(seconds)
    await this.appendMessage(chat.id, systemMessage('timer', label))
    try {
      await this.sendPayload(state, {
        v: 1,
        kind: 'timer',
        text: label,
        sentAt: new Date().toISOString(),
        timerSeconds: seconds,
      })
    } catch {
      // The setting is local and the next message carries it too; a control
      // message that could not be sent must not lose the choice.
    }
  }

  async setVerified(chat: SecretChat, verified: boolean): Promise<SecretChatView> {
    const state = await this.loadState(chat)
    state.verified = verified
    state.verifiedDigits = verified ? state.safetyNumber.digits : undefined
    if (verified) {
      state.keyChanged = false
    }
    await this.saveState(state)
    return this.view(chat.id)
  }

  /** Removes expired messages from this device; returns how many went. */
  async sweep(chatId: string): Promise<number> {
    const messages = this.messages.get(chatId)
    if (!messages) {
      return 0
    }
    const kept = messages.filter((message) => !isExpired(message))
    const removed = messages.length - kept.length
    if (removed > 0) {
      this.messages.set(chatId, kept)
      await this.saveMessages(chatId)
    }
    return removed
  }

  /** Handles one envelope from the personal stream. */
  async receive(envelope: SecretEnvelope): Promise<SecretMessage | null> {
    const state = this.states.get(envelope.secretChatId)
    if (!state) {
      // Not open on this screen; the catch-up on open will pick it up.
      return null
    }
    if (envelope.recipientDeviceId !== this.device.deviceId) {
      return null
    }
    if (envelope.senderDeviceId !== state.chat.peer.deviceId) {
      await this.api.acknowledgeSecretEnvelope(this.device.deviceId, envelope.id)
      return this.appendMessage(
        state.chat.id,
        systemMessage('error', 'Сообщение пришло с чужого устройства и не было открыто.'),
      )
    }
    if (isExpiredAt(envelope.expiresAt)) {
      await this.api.acknowledgeSecretEnvelope(this.device.deviceId, envelope.id)
      return null
    }

    const plaintext = await this.decryptBody(state, envelope.type, envelope.body)
    if (plaintext === null) {
      await this.api.acknowledgeSecretEnvelope(this.device.deviceId, envelope.id)
      return this.appendMessage(
        state.chat.id,
        systemMessage(
          'error',
          'Не удалось расшифровать сообщение: ключ не подходит или сообщение было изменено.',
        ),
      )
    }
    const payload = parsePayload(plaintext)
    if (!payload) {
      await this.api.acknowledgeSecretEnvelope(this.device.deviceId, envelope.id)
      return this.appendMessage(
        state.chat.id,
        systemMessage('error', 'Не удалось прочитать сообщение: неизвестный формат.'),
      )
    }

    if (payload.kind === 'timer') {
      state.timerSeconds = isTimer(payload.timerSeconds) ? payload.timerSeconds : state.timerSeconds
      await this.saveState(state)
      await this.api.acknowledgeSecretEnvelope(this.device.deviceId, envelope.id)
      return this.appendMessage(
        state.chat.id,
        systemMessage('timer', `Собеседник установил: ${timerLabel(payload.timerSeconds)}`),
      )
    }

    if (state.timerSeconds !== payload.timerSeconds && isTimer(payload.timerSeconds)) {
      state.timerSeconds = payload.timerSeconds
      await this.saveState(state)
    }

    const receivedAt = new Date()
    let file: SecretFile | undefined
    if (payload.kind === 'file' && payload.file) {
      try {
        file = await this.downloadFile(payload.file.attachmentId, payload.file.meta)
      } catch {
        // The bytes are not here yet: keep the envelope, a later open retries.
        return null
      }
    }

    await this.api.acknowledgeSecretEnvelope(this.device.deviceId, envelope.id)
    const message = await this.appendMessage(state.chat.id, {
      id: crypto.randomUUID(),
      author: 'peer',
      kind: payload.kind === 'file' ? 'file' : 'text',
      text: payload.text,
      ...(file ? { file } : {}),
      createdAt: receivedAt.toISOString(),
      ...(state.timerSeconds > 0
        ? { expiresAt: new Date(receivedAt.getTime() + state.timerSeconds * 1000).toISOString() }
        : {}),
    })
    await this.saveState(state)
    return message
  }

  private async loadState(chat: SecretChat): Promise<SecretChatState> {
    const peerKeys = `${chat.peer.identityKey}|${chat.peer.signingKey}`
    const safetyNumber = await calculateSafetyNumber(this.identity, {
      identityKey: chat.peer.identityKey,
      signingKey: chat.peer.signingKey,
    })
    const cached = this.states.get(chat.id)
    if (cached) {
      if (cached.peerKeys !== peerKeys) {
        await this.noteKeyChange(cached, chat, peerKeys, safetyNumber)
      }
      cached.chat = chat
      cached.safetyNumber = safetyNumber
      await this.saveState(cached)
      return cached
    }

    const stored = await this.store.get<SecretChatState>(chatScope, chat.id, null)

    let state: SecretChatState
    if (stored) {
      state = { ...stored, chat, safetyNumber }
      if (stored.peerKeys !== peerKeys) {
        // The peer device replaced its keys. The old session is useless and a
        // verification mark must not survive the change silently.
        state.keyChanged = true
        state.verified = false
        state.verifiedDigits = undefined
        state.session = undefined
        state.peerKeys = peerKeys
        await this.saveState(state)
        await this.appendMessage(
          chat.id,
          systemMessage(
            'error',
            'Ключ шифрования собеседника изменился. Проверьте код безопасности заново.',
          ),
        )
      }
    } else {
      state = {
        chat,
        verified: false,
        keyChanged: false,
        timerSeconds: 0,
        peerKeys,
        safetyNumber,
      }
      await this.saveState(state)
    }
    this.states.set(chat.id, state)
    return state
  }

  private async noteKeyChange(
    state: SecretChatState,
    chat: SecretChat,
    peerKeys: string,
    safetyNumber: SafetyNumber,
  ): Promise<void> {
    state.chat = chat
    state.safetyNumber = safetyNumber
    state.keyChanged = true
    state.verified = false
    state.verifiedDigits = undefined
    state.session = undefined
    state.peerKeys = peerKeys
    await this.saveState(state)
    await this.appendMessage(
      chat.id,
      systemMessage(
        'error',
        'Ключ шифрования собеседника изменился. Проверьте код безопасности заново.',
      ),
    )
  }

  private async loadMessages(chatId: string): Promise<void> {
    if (this.messages.has(chatId)) {
      return
    }
    this.messages.set(
      chatId,
      (await this.store.get<SecretMessage[]>(messagesScope, chatId, null)) ?? [],
    )
  }

  private async drain(chatId: string): Promise<void> {
    let envelopes: SecretEnvelope[]
    try {
      envelopes = await this.api.listSecretEnvelopes(this.device.deviceId, chatId)
    } catch {
      return
    }
    for (const envelope of envelopes) {
      await this.receive(envelope)
    }
  }

  private async appendMessage(chatId: string, message: SecretMessage): Promise<SecretMessage> {
    await this.loadMessages(chatId)
    const messages = this.messages.get(chatId) ?? []
    messages.push(message)
    this.messages.set(chatId, messages)
    await this.saveMessages(chatId)
    return message
  }

  private async saveMessages(chatId: string): Promise<void> {
    await this.store.set(messagesScope, chatId, this.messages.get(chatId) ?? [])
  }

  private async saveState(state: SecretChatState): Promise<void> {
    this.states.set(state.chat.id, state)
    const stored: Omit<SecretChatState, 'safetyNumber'> = {
      chat: state.chat,
      ...(state.session === undefined ? {} : { session: state.session }),
      verified: state.verified,
      ...(state.verifiedDigits === undefined ? {} : { verifiedDigits: state.verifiedDigits }),
      keyChanged: state.keyChanged,
      timerSeconds: state.timerSeconds,
      peerKeys: state.peerKeys,
    }
    await this.store.set(chatScope, state.chat.id, stored)
  }

  private async sendPayload(state: SecretChatState, payload: SecretPayload): Promise<void> {
    await this.ensureSession(state)
    const encrypted = await this.engine.encrypt(state.chat.id, JSON.stringify(payload))
    state.session = await sealWith(this.wrapKey, await this.engine.pickleSession(state.chat.id))
    await this.saveState(state)
    await this.api.sendSecretEnvelope(this.device.deviceId, state.chat.id, {
      recipientDeviceId: state.chat.peer.deviceId,
      type: encrypted.type,
      body: encrypted.body,
      expiresAt: envelopeTTL(state.timerSeconds),
    })
  }

  /** The session of this chat, creating the outbound one from a pre-key bundle. */
  private async ensureSession(state: SecretChatState): Promise<void> {
    if (state.session) {
      await this.engine.unpickleSession(state.chat.id, await openWith(this.wrapKey, state.session))
      return
    }
    const bundle = await this.api.getKeyBundle(state.chat.peer.deviceId)
    if (bundle.device.identityKey !== state.chat.peer.identityKey) {
      throw new SecretKeyError('Ключ собеседника на сервере не совпадает с ключом чата.')
    }
    await this.engine.createOutbound(
      state.chat.id,
      bundle.device.identityKey,
      bundle.oneTimeKey.key,
    )
    state.session = await sealWith(this.wrapKey, await this.engine.pickleSession(state.chat.id))
    await this.saveState(state)
  }

  private async decryptBody(
    state: SecretChatState,
    type: 0 | 1,
    body: string,
  ): Promise<string | null> {
    if (state.session) {
      try {
        await this.engine.unpickleSession(
          state.chat.id,
          await openWith(this.wrapKey, state.session),
        )
        const plaintext = await this.engine.decrypt(state.chat.id, type, body)
        state.session = await sealWith(this.wrapKey, await this.engine.pickleSession(state.chat.id))
        await this.saveState(state)
        return plaintext
      } catch {
        if (type !== 0) {
          return null
        }
      }
    }
    if (type !== 0) {
      return null
    }
    try {
      await this.engine.createInbound(state.chat.id, state.chat.peer.identityKey, body)
      // The pre-key was spent on the account; its pickle must say so, or a
      // reload would keep offering a key the peer already used.
      await this.persistAccount()
      const plaintext = await this.engine.decrypt(state.chat.id, type, body)
      state.session = await sealWith(this.wrapKey, await this.engine.pickleSession(state.chat.id))
      await this.saveState(state)
      return plaintext
    } catch {
      return null
    }
  }

  private async downloadFile(attachmentId: string, meta: EncryptedFileMeta): Promise<SecretFile> {
    const url = await this.api.attachmentLink(attachmentId)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Не удалось скачать вложение')
    }
    const blob = await decryptFile(await response.arrayBuffer(), meta)
    return { name: meta.name, mimeType: meta.mimeType, size: meta.size, blob }
  }

  private async publishPreKeys(count: number): Promise<void> {
    const keys = await this.engine.generateOneTimeKeys(count)
    if (keys.length === 0) {
      return
    }
    await this.api.uploadOneTimeKeys(this.device.deviceId, keys)
    await this.engine.markKeysAsPublished()
    await this.persistAccount()
  }

  /** The account changes when a pre-key is spent or published; keep it sealed. */
  private async persistAccount(): Promise<void> {
    await this.store.set(
      accountScope,
      'account',
      await sealWith(this.wrapKey, await this.engine.pickleAccount()),
    )
  }

  private async refillPreKeys(): Promise<void> {
    const count = await this.api.countOneTimeKeys(this.device.deviceId)
    if (count < PREKEY_LOW_WATER) {
      await this.publishPreKeys(PREKEY_BATCH)
    }
  }
}

export class SecretKeyError extends Error {}

const ensureWrapKey = async (store: PlatformSecretStore): Promise<CryptoKey> => {
  const existing = await store.get<CryptoKey>(accountScope, 'wrap', null)
  if (existing) {
    return existing
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ])
  await store.set(accountScope, 'wrap', key)
  return key
}

export const timerLabel = (seconds: number): string => {
  switch (seconds) {
    case 5:
      return '5 секунд'
    case 30:
      return '30 секунд'
    case 60:
      return '1 минута'
    case 3600:
      return '1 час'
    case 86_400:
      return '1 день'
    case 604_800:
      return '1 неделя'
    default:
      return 'Таймер выключен'
  }
}

const isExpiredAt = (value: string | Date): boolean => new Date(value).getTime() <= Date.now()

const isExpired = (message: SecretMessage): boolean =>
  message.expiresAt !== undefined && isExpiredAt(message.expiresAt)
