import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

import type {
  SecretChatView,
  SecretMessage,
  SecretTimer,
  StoredSecretDevice,
} from '@/entities/secret-session'
import type { SecretChat } from '@/shared/api'
import type { SafetyNumber } from '@/shared/crypto'
import { renderWithProviders } from '@/shared/lib/test'

import SecretChatPage from './SecretChatPage'

import type { SecretChatPageDeps, SecretChatSession } from '../model/useSecretChat'

const BANNER =
  'Сообщения зашифрованы на ваших устройствах. Сервер Orbit не может их прочитать. Чат доступен только на этом устройстве'
const EMPTY = 'Сообщений пока нет. Напишите первым — сообщение зашифруется на этом устройстве.'

const chat: SecretChat = {
  id: 'secret-chat-1',
  createdAt: new Date('2026-10-20T10:00:00Z'),
  peer: {
    userId: 'peer-1',
    nickname: 'Аня',
    isGuest: false,
    deviceId: 'peer-device',
    identityKey: 'peer-identity-key',
    signingKey: 'peer-signing-key',
  },
}

const device: StoredSecretDevice = {
  deviceId: 'device-1',
  userId: 'user-1',
  name: 'Этот браузер',
  identityKey: 'my-identity-key',
  signingKey: 'my-signing-key',
}

const emoji = ['🐶', '🐱', '🦊', '🐻', '🐼', '🐨']
const groups = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(5, '0'))
const digits = groups.join('')
const safetyNumber: SafetyNumber = {
  emoji: Array.from({ length: 30 }, (_, index) => emoji[index % emoji.length] ?? '🐶'),
  groups,
  digits,
  qr: `orbit:v1:${digits}`,
}

interface FakeOptions {
  messages?: SecretMessage[]
  verified?: boolean
  keyChanged?: boolean
  timerSeconds?: number
}

/** A session with the same contract as `SecretSession`, without any crypto. */
const createFakeSession = (options: FakeOptions = {}): SecretChatSession => {
  let messages = [...(options.messages ?? [])]
  let verified = options.verified ?? false
  let keyChanged = options.keyChanged ?? false
  let timerSeconds = options.timerSeconds ?? 0
  let verifiedDigits: string | undefined

  const notExpired = (message: SecretMessage) => {
    return message.expiresAt === undefined || Date.parse(message.expiresAt) > Date.now()
  }

  const buildView = (): SecretChatView => {
    return {
      chat,
      messages: messages.filter(notExpired),
      verified,
      ...(verifiedDigits === undefined ? {} : { verifiedDigits }),
      keyChanged,
      timerSeconds,
      safetyNumber,
    }
  }

  return {
    openChat: vi.fn(() => Promise.resolve(buildView())),
    receive: vi.fn(() => Promise.resolve(null)),
    sweep: vi.fn(() => {
      const before = messages.length
      messages = messages.filter(notExpired)
      return Promise.resolve(before - messages.length)
    }),
    view: vi.fn(() => buildView()),
    sendText: vi.fn((_target: SecretChat, text: string) => {
      const message: SecretMessage = {
        id: crypto.randomUUID(),
        author: 'me',
        kind: 'text',
        text,
        createdAt: new Date().toISOString(),
      }
      messages = [...messages, message]
      return Promise.resolve(message)
    }),
    sendFile: vi.fn((_target: SecretChat, file: File) => {
      const message: SecretMessage = {
        id: crypto.randomUUID(),
        author: 'me',
        kind: 'file',
        text: '',
        file: { name: file.name, mimeType: file.type, size: file.size, blob: file },
        createdAt: new Date().toISOString(),
      }
      messages = [...messages, message]
      return Promise.resolve(message)
    }),
    setTimer: vi.fn((_target: SecretChat, seconds: SecretTimer) => {
      timerSeconds = seconds
      return Promise.resolve()
    }),
    deleteChat: vi.fn(() => Promise.resolve()),
    setVerified: vi.fn((_target: SecretChat, next: boolean) => {
      verified = next
      verifiedDigits = next ? digits : undefined
      if (next) {
        keyChanged = false
      }
      return Promise.resolve(buildView())
    }),
  }
}

const makeDeps = (
  session: SecretChatSession,
  overrides: Partial<SecretChatPageDeps> = {},
): SecretChatPageDeps => ({
  secretChatId: chat.id,
  device,
  chats: [chat],
  isDeviceLoading: false,
  isChatsLoading: false,
  userId: 'user-1',
  listen: () => () => undefined,
  openSession: () => Promise.resolve(session),
  ...overrides,
})

const renderPage = (session: SecretChatSession, overrides: Partial<SecretChatPageDeps> = {}) => {
  return renderWithProviders(
    <MemoryRouter>
      <SecretChatPage deps={makeDeps(session, overrides)} />
    </MemoryRouter>,
  )
}

const message = (overrides: Partial<SecretMessage> = {}): SecretMessage => ({
  id: crypto.randomUUID(),
  author: 'peer',
  kind: 'text',
  text: 'Привет',
  createdAt: new Date().toISOString(),
  ...overrides,
})

it('shows the encryption banner and the empty state', async () => {
  renderPage(createFakeSession())

  expect(await screen.findByText(BANNER)).toBeInTheDocument()
  expect(screen.getByText(EMPTY)).toBeInTheDocument()
  expect(screen.getByText('Только на этом устройстве')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled()
})

it('opens the honest details behind «Подробнее»', async () => {
  renderPage(createFakeSession())
  await screen.findByText(BANNER)

  await userEvent.click(screen.getByRole('button', { name: 'Подробнее' }))

  const dialog = await screen.findByRole('dialog', { name: 'Как устроено шифрование' })
  expect(within(dialog).getByText(/Сервер Orbit видит/)).toBeInTheDocument()
  expect(within(dialog).getByText(/Браузер не может запретить скриншоты/)).toBeInTheDocument()
  expect(within(dialog).getByText(/Взломанное устройство/)).toBeInTheDocument()
  expect(within(dialog).getByText(/Очистка данных сайта/)).toBeInTheDocument()
})

it('sends typed text through the session', async () => {
  const session = createFakeSession()
  renderPage(session)
  await screen.findByText(BANNER)

  const field = screen.getByRole('textbox', { name: 'Сообщение' })
  await userEvent.type(field, 'Привет')
  await userEvent.click(screen.getByRole('button', { name: 'Отправить' }))

  expect(session.sendText).toHaveBeenCalledWith(chat, 'Привет')
  expect(await screen.findByText('Привет')).toBeInTheDocument()
})

it('changes the timer from the menu and marks the choice', async () => {
  const session = createFakeSession()
  renderPage(session)
  await screen.findByText(BANNER)

  await userEvent.click(screen.getByRole('button', { name: 'Таймер самоуничтожения' }))

  expect(
    await screen.findByText(/Отсчёт начнётся у отправителя сразу после отправки/),
  ).toBeInTheDocument()
  await userEvent.click(screen.getByRole('menuitemradio', { name: '5 секунд' }))

  expect(session.setTimer).toHaveBeenCalledWith(chat, 5)
  expect(await screen.findByText('Таймер самоуничтожения: 5 секунд.')).toBeInTheDocument()
})

it('shows the safety number and toggles the verified mark', async () => {
  const session = createFakeSession()
  renderPage(session)
  await screen.findByText(BANNER)

  await userEvent.click(screen.getByRole('button', { name: 'Шифрование' }))
  const dialog = await screen.findByRole('dialog', { name: 'Шифрование' })

  expect(within(dialog).getByText('00001')).toBeInTheDocument()
  expect(
    within(dialog).getByRole('img', { name: 'QR-код для сверки кода безопасности' }),
  ).toBeInTheDocument()
  const verified = within(dialog).getByRole('button', { name: 'Проверено' })
  expect(verified).toHaveAttribute('aria-pressed', 'false')

  await userEvent.click(verified)
  expect(session.setVerified).toHaveBeenCalledWith(chat, true)
  await waitFor(() => {
    expect(within(dialog).getByRole('button', { name: 'Проверено' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  await userEvent.click(within(dialog).getByRole('button', { name: 'Проверено' }))
  expect(session.setVerified).toHaveBeenLastCalledWith(chat, false)
})

it('blocks the composer when the peer key changed', async () => {
  renderPage(createFakeSession({ keyChanged: true }))
  await screen.findByText(BANNER)

  expect(screen.getByText('Ключ шифрования собеседника изменился')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Сообщение' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Отправить' })).toBeDisabled()
  expect(screen.getAllByRole('button', { name: 'Шифрование' })).toHaveLength(2)
})

it('drops expired messages when the sweep runs', async () => {
  const expiring = message({
    id: 'expiring',
    text: 'Скоро исчезнет',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1200).toISOString(),
  })
  const session = createFakeSession({
    messages: [expiring, message({ id: 'stays', text: 'Останется' })],
  })
  renderPage(session)

  expect(await screen.findByText('Скоро исчезнет')).toBeInTheDocument()
  expect(screen.getByText('Останется')).toBeInTheDocument()

  await waitFor(
    () => {
      expect(screen.queryByText('Скоро исчезнет')).not.toBeInTheDocument()
    },
    { timeout: 3500 },
  )
  expect(session.sweep).toHaveBeenCalledWith(chat.id)
  expect(screen.getByText('Останется')).toBeInTheDocument()
})

it('deletes the chat from its menu after confirmation', async () => {
  const session = createFakeSession()
  renderPage(session)
  await screen.findByText(/Сообщения зашифрованы/)

  await userEvent.click(screen.getByRole('button', { name: 'Действия с чатом' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Удалить секретный чат' }))
  await userEvent.click(screen.getByRole('button', { name: 'Удалить' }))

  await waitFor(() => {
    expect(session.deleteChat).toHaveBeenCalledWith(chat.id)
  })
})
