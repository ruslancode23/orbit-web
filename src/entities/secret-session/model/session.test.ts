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
import { decryptFile, encryptFile } from '@/shared/crypto'
import { createFakeSecretStore } from '@/shared/lib/test'
import type { PlatformSecretStore } from '@/shared/platform'

import { SecretSession } from './session'

import type { SecretApi } from './api'

interface NetworkDevice {
  device: Device
  userId: string
  nickname: string
}

interface NetworkChat {
  id: string
  createdAt: Date
  /** Sorted by device id, so both sides find the chat by the same key. */
  members: [NetworkDevice, NetworkDevice]
}

/** An in-memory orbit-server for the secret chat endpoints. */
class FakeNetwork {
  readonly devices = new Map<string, NetworkDevice>()
  readonly prekeys = new Map<string, OneTimeKey[]>()
  readonly chats = new Map<string, NetworkChat>()
  readonly envelopes: SecretEnvelope[] = []
  readonly files = new Map<string, Blob>()

  api(userId: string, nickname: string): SecretApi {
    return {
      registerDevice: (input: DeviceRegistration) => this.register(userId, nickname, input),
      uploadOneTimeKeys: (deviceId, keys) => this.uploadKeys(deviceId, keys),
      countOneTimeKeys: (deviceId) => Promise.resolve(this.prekeys.get(deviceId)?.length ?? 0),
      getKeyBundle: (deviceId) => this.bundle(deviceId),
      listSecretChats: (deviceId) => this.listChats(deviceId),
      startSecretChat: (deviceId, input) => this.startChat(deviceId, input),
      listSecretEnvelopes: (deviceId, chatId) =>
        Promise.resolve(
          this.envelopes.filter(
            (envelope) =>
              envelope.secretChatId === chatId &&
              envelope.recipientDeviceId === deviceId &&
              new Date(envelope.expiresAt).getTime() > Date.now(),
          ),
        ),
      sendSecretEnvelope: (deviceId, chatId, input) => this.send(deviceId, chatId, input),
      leaveSecretChat: (_deviceId, chatId) => {
        const chat = this.chats.get(chatId)
        if (chat) {
          this.chats.delete(chatId)
        }
        return Promise.resolve()
      },
      acknowledgeSecretEnvelope: (_deviceId, envelopeId) => {
        const index = this.envelopes.findIndex((envelope) => envelope.id === envelopeId)
        if (index >= 0) {
          this.envelopes.splice(index, 1)
        }
        return Promise.resolve()
      },
      uploadFile: (_chatId, blob) => {
        const id = crypto.randomUUID()
        this.files.set(id, blob)
        const attachment: Attachment = {
          id,
          fileName: 'encrypted.bin',
          mimeType: 'application/octet-stream',
          sizeBytes: BigInt(blob.size),
          createdAt: new Date(),
        }
        return Promise.resolve(attachment)
      },
      attachmentLink: (attachmentId) => Promise.resolve(`https://files.test/${attachmentId}`),
    }
  }

  private register(userId: string, nickname: string, input: DeviceRegistration): Promise<Device> {
    const device: Device = {
      id: crypto.randomUUID(),
      userId,
      name: input.name ?? '',
      identityKey: input.identityKey,
      signingKey: input.signingKey,
      createdAt: new Date(),
    }
    this.devices.set(device.id, { device, userId, nickname })
    return Promise.resolve(device)
  }

  private uploadKeys(deviceId: string, keys: OneTimeKey[]): Promise<number> {
    const existing = this.prekeys.get(deviceId) ?? []
    const merged = [...existing, ...keys]
    this.prekeys.set(deviceId, merged)
    return Promise.resolve(merged.length)
  }

  private bundle(deviceId: string): Promise<KeyBundle> {
    const entry = this.devices.get(deviceId)
    const keys = this.prekeys.get(deviceId) ?? []
    const key = keys.shift()
    if (!entry || !key) {
      return Promise.reject(new Error('no key bundle'))
    }
    this.prekeys.set(deviceId, keys)
    return Promise.resolve({ device: entry.device, oneTimeKey: key })
  }

  private listChats(deviceId: string): Promise<SecretChat[]> {
    const out: SecretChat[] = []
    for (const chat of this.chats.values()) {
      const view = this.viewFor(chat, deviceId)
      if (view) {
        out.push(view)
      }
    }
    return Promise.resolve(out)
  }

  private viewFor(chat: NetworkChat, deviceId: string): SecretChat | null {
    const mine = chat.members.find((member) => member.device.id === deviceId)
    const peer = chat.members.find((member) => member.device.id !== deviceId)
    if (!mine || !peer) {
      return null
    }
    return {
      id: chat.id,
      createdAt: chat.createdAt,
      peer: {
        userId: peer.userId,
        nickname: peer.nickname,
        isGuest: false,
        deviceId: peer.device.id,
        identityKey: peer.device.identityKey,
        signingKey: peer.device.signingKey,
      },
    }
  }

  private startChat(deviceId: string, input: SecretChatStartRequest): Promise<SecretChat> {
    const mine = this.devices.get(deviceId)
    const peer = input.peerDeviceId
      ? this.devices.get(input.peerDeviceId)
      : [...this.devices.values()].find((entry) => entry.userId === input.userId)
    if (!mine || !peer) {
      return Promise.reject(new Error('no such device'))
    }
    const key = [deviceId, peer.device.id].sort().join(':')
    const existing = this.chats.get(key)
    if (existing) {
      const view = this.viewFor(existing, deviceId)
      return view ? Promise.resolve(view) : Promise.reject(new Error('not a participant'))
    }
    const members = [mine, peer].sort((a, b) => a.device.id.localeCompare(b.device.id))
    const [first, second] = members
    if (!first || !second) {
      return Promise.reject(new Error('a chat needs two devices'))
    }
    const chat: NetworkChat = {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      members: [first, second],
    }
    this.chats.set(key, chat)
    const view = this.viewFor(chat, deviceId)
    return view ? Promise.resolve(view) : Promise.reject(new Error('not a participant'))
  }

  private send(
    deviceId: string,
    chatId: string,
    input: SecretEnvelopeCreate,
  ): Promise<SecretEnvelope> {
    const envelope: SecretEnvelope = {
      id: crypto.randomUUID(),
      secretChatId: chatId,
      senderDeviceId: deviceId,
      recipientDeviceId: input.recipientDeviceId,
      type: input.type,
      body: input.body,
      createdAt: new Date(),
      expiresAt: input.expiresAt,
    }
    this.envelopes.push(envelope)
    return Promise.resolve(envelope)
  }
}

const openDevice = async (
  network: FakeNetwork,
  store: PlatformSecretStore,
  userId: string,
  nickname: string,
): Promise<SecretSession> =>
  SecretSession.open(network.api(userId, nickname), store, userId, `${nickname} browser`)

const twoDevices = async () => {
  const network = new FakeNetwork()
  const anna = crypto.randomUUID()
  const bob = crypto.randomUUID()
  const annaStore = createFakeSecretStore()
  const bobStore = createFakeSecretStore()
  const annaSession = await openDevice(network, annaStore, anna, 'Аня')
  const bobSession = await openDevice(network, bobStore, bob, 'Боб')
  await annaSession.startChat(bob, bobSession.currentDevice.deviceId)
  const annaChat = (await annaSession.listChats())[0]
  const bobChat = (await bobSession.listChats())[0]
  if (!annaChat || !bobChat) {
    throw new Error('the chat was not created')
  }
  return { network, anna, bob, annaStore, bobStore, annaSession, bobSession, annaChat, bobChat }
}

describe('secret session', () => {
  it('exchanges messages in both directions and shows the same safety number', async () => {
    const { network, annaSession, bobSession, annaChat, bobChat } = await twoDevices()

    const annaView = await annaSession.openChat(annaChat)
    const bobView = await bobSession.openChat(bobChat)

    expect(annaView.safetyNumber.digits).toHaveLength(60)
    expect(annaView.safetyNumber.digits).toBe(bobView.safetyNumber.digits)
    expect(annaView.safetyNumber.emoji).toHaveLength(30)

    await annaSession.sendText(annaChat, 'привет, это секретный чат')
    const wire = network.envelopes.at(-1)
    expect(wire?.body).toBeTruthy()
    expect(wire?.body).not.toContain('привет, это секретный чат')
    const received = await bobSession.refresh(annaChat.id)
    expect(received.messages.at(-1)).toMatchObject({
      author: 'peer',
      kind: 'text',
      text: 'привет, это секретный чат',
    })

    await bobSession.sendText(bobView.chat, 'и тебе привет')
    const reply = await annaSession.refresh(annaChat.id)
    expect(reply.messages.at(-1)).toMatchObject({ author: 'peer', text: 'и тебе привет' })
  })

  it('survives a reload: the account pickle and the session are on the device', async () => {
    const { network, anna, annaStore, bobSession, annaChat, bobChat } = await twoDevices()
    const reopened = await openDevice(network, annaStore, anna, 'Аня')
    const view = await reopened.openChat(annaChat)
    expect(view.messages).toHaveLength(0)
    await bobSession.openChat(bobChat)

    await reopened.sendText(annaChat, 'после перезагрузки')
    const received = await bobSession.refresh(annaChat.id)
    expect(received.messages.at(-1)?.text).toBe('после перезагрузки')
  })

  it('rejects a replayed envelope instead of showing the message twice', async () => {
    const { network, annaSession, bobSession, annaChat, bobChat } = await twoDevices()
    await annaSession.openChat(annaChat)
    await bobSession.openChat(bobChat)
    await annaSession.sendText(annaChat, 'одноразовое')
    const envelope = network.envelopes[0]
    expect(envelope).toBeDefined()
    const delivered = await bobSession.refresh(annaChat.id)
    expect(delivered.messages.filter((message) => message.text === 'одноразовое')).toHaveLength(1)

    if (envelope) {
      network.envelopes.push({ ...envelope, id: crypto.randomUUID() })
    }
    const afterReplay = await bobSession.refresh(annaChat.id)
    expect(afterReplay.messages.filter((message) => message.text === 'одноразовое')).toHaveLength(1)
    expect(afterReplay.messages.at(-1)).toMatchObject({ author: 'system', kind: 'error' })
  })

  it('shows a changed peer key and resets verification', async () => {
    const { annaSession, annaChat } = await twoDevices()
    const verified = await annaSession.setVerified(annaChat, true)
    expect(verified.verified).toBe(true)

    const changed: SecretChat = {
      ...annaChat,
      peer: {
        ...annaChat.peer,
        identityKey: 'a-different-identity-key',
        signingKey: 'a-different-signing-key',
      },
    }
    const view = await annaSession.openChat(changed)
    expect(view.keyChanged).toBe(true)
    expect(view.verified).toBe(false)
    expect(
      view.messages.some((message) =>
        message.text.includes('Ключ шифрования собеседника изменился'),
      ),
    ).toBe(true)
  })

  it('never writes keys or plaintext to localStorage', async () => {
    const { annaSession, annaChat } = await twoDevices()
    await annaSession.openChat(annaChat)
    await annaSession.sendText(annaChat, 'секрет')
    expect(localStorage.length).toBe(0)
  })
})

describe('encrypted attachments', () => {
  it('encrypts on one side and decrypts on the other', async () => {
    const file = new File([new TextEncoder().encode('секретный файл')], 'note.txt', {
      type: 'text/plain',
    })
    const encrypted = await encryptFile(file)
    expect(encrypted.meta.name).toBe('note.txt')
    expect(encrypted.blob.size).toBeGreaterThan(0)
    // The server stores an opaque blob, not a text file it could open.
    expect(encrypted.blob.type).toBe('application/octet-stream')
    const stored = new Uint8Array(await encrypted.blob.arrayBuffer())
    const plain = new TextEncoder().encode('секретный файл')
    expect(stored).not.toEqual(plain)

    const decrypted = await decryptFile(await encrypted.blob.arrayBuffer(), encrypted.meta)
    expect(await decrypted.text()).toBe('секретный файл')
    expect(decrypted.type).toBe('text/plain')
  })

  it('does not decrypt with the wrong key', async () => {
    const file = new File([new TextEncoder().encode('секретный файл')], 'note.txt', {
      type: 'text/plain',
    })
    const encrypted = await encryptFile(file)
    const other = await encryptFile(file)
    await expect(
      decryptFile(await encrypted.blob.arrayBuffer(), { ...encrypted.meta, key: other.meta.key }),
    ).rejects.toBeTruthy()
  })
})

it('deleting a chat removes it on the server and wipes this device', async () => {
  const { annaSession, annaChat, annaStore } = await twoDevices()
  await annaSession.openChat(annaChat)
  await annaSession.sendText(annaChat, 'удалить меня')

  await annaSession.deleteChat(annaChat.id)

  expect(await annaStore.get('secret-chat', annaChat.id, null)).toBeNull()
  expect(await annaStore.get('secret-messages', annaChat.id, null)).toBeNull()
})
