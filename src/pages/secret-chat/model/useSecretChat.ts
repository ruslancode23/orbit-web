import { useEffect, useMemo, useState } from 'react'

import type { LiveListener } from '@/entities/live'
import type {
  SecretChatView,
  SecretMessage,
  SecretTimer,
  StoredSecretDevice,
} from '@/entities/secret-session'
import type { SecretChat, SecretEnvelope } from '@/shared/api'

import { parseSecretEnvelope } from './secret-envelope'

/**
 * The part of `SecretSession` this screen uses. The real class satisfies it,
 * and tests bring a fake without mocking the crypto core.
 */
export interface SecretChatSession {
  openChat: (chat: SecretChat) => Promise<SecretChatView>
  receive: (envelope: SecretEnvelope) => Promise<SecretMessage | null>
  sweep: (chatId: string) => Promise<number>
  view: (chatId: string) => SecretChatView
  sendText: (chat: SecretChat, text: string) => Promise<SecretMessage>
  sendFile: (chat: SecretChat, file: File) => Promise<SecretMessage>
  setTimer: (chat: SecretChat, seconds: SecretTimer) => Promise<void>
  setVerified: (chat: SecretChat, verified: boolean) => Promise<SecretChatView>
}

/**
 * Everything the screen needs from outside, so a test can hand it a device, a
 * chat and a fake session instead of querying the server and loading libolm.
 */
export interface SecretChatPageDeps {
  secretChatId: string | undefined
  device: StoredSecretDevice | null | undefined
  chats: SecretChat[] | undefined
  isDeviceLoading: boolean
  isChatsLoading: boolean
  userId: string | undefined
  listen: (listener: LiveListener) => () => void
  openSession: (userId: string) => Promise<SecretChatSession>
}

export interface SecretChatActions {
  sendText: (text: string) => Promise<boolean>
  sendFile: (file: File) => Promise<boolean>
  setTimer: (seconds: SecretTimer) => Promise<boolean>
  setVerified: (verified: boolean) => Promise<boolean>
}

export interface SecretChatResult {
  view: SecretChatView | null
  loading: boolean
  error: string | null
  session: SecretChatSession | null
  chat: SecretChat | undefined
  sending: boolean
  actions: SecretChatActions
}

interface Positioned<T> {
  chatId: string
  value: T
}

const describeSecretError = (cause: unknown, fallback: string): string => {
  if (cause instanceof Error && /[А-Яа-яЁё]/u.test(cause.message)) {
    return cause.message
  }
  return fallback
}

/**
 * Owns this screen's `SecretSession` and the view it shows: opens the chat,
 * receives live envelopes, sweeps expired messages every second and runs the
 * actions the UI offers. Dependencies are injected so the page can be rendered
 * with a fake session in tests.
 */
export const useSecretChat = (deps: SecretChatPageDeps): SecretChatResult => {
  const { secretChatId, chats, isDeviceLoading, isChatsLoading, userId, listen, openSession } = deps
  const chat = useMemo(() => chats?.find((item) => item.id === secretChatId), [chats, secretChatId])

  const [opened, setOpened] = useState<Positioned<SecretChatSession> | null>(null)
  const [current, setCurrent] = useState<Positioned<SecretChatView> | null>(null)
  const [failure, setFailure] = useState<Positioned<string> | null>(null)
  const [sending, setSending] = useState(false)

  const session = chat && opened?.chatId === chat.id ? opened.value : null
  const view = chat && current?.chatId === chat.id ? current.value : null
  const error = chat && failure?.chatId === chat.id ? failure.value : null
  const loading = chat ? view === null && error === null : isDeviceLoading || isChatsLoading

  useEffect(() => {
    if (userId === undefined || !chat) {
      return undefined
    }
    let cancelled = false
    const isCancelled = () => cancelled
    const run = async () => {
      try {
        const next = await openSession(userId)
        if (isCancelled()) {
          return
        }
        const openedView = await next.openChat(chat)
        if (isCancelled()) {
          return
        }
        setOpened({ chatId: chat.id, value: next })
        setCurrent({ chatId: chat.id, value: openedView })
        setFailure(null)
      } catch (cause) {
        if (!isCancelled()) {
          setFailure({
            chatId: chat.id,
            value: describeSecretError(cause, 'Не удалось открыть секретный чат.'),
          })
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [chat, userId, openSession])

  useEffect(() => {
    if (!session || !chat) {
      return undefined
    }
    let cancelled = false
    // Envelopes arrive one after another on the stream, but each `receive` is
    // asynchronous and the Olm session is not re-entrant: handle them in order.
    let queue: Promise<void> = Promise.resolve()
    const unsubscribe = listen((event) => {
      if (event.type !== 'secret.envelope') {
        return
      }
      const envelope = parseSecretEnvelope(event.payload)
      if (!envelope) {
        return
      }
      if (envelope.secretChatId !== chat.id) {
        return
      }
      queue = queue.then(async () => {
        try {
          await session.receive(envelope)
          if (cancelled) {
            return
          }
          setCurrent({ chatId: chat.id, value: session.view(chat.id) })
          setFailure(null)
        } catch (cause) {
          if (!cancelled) {
            setFailure({
              chatId: chat.id,
              value: describeSecretError(cause, 'Не удалось принять сообщение.'),
            })
          }
        }
      })
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [session, chat, listen])

  useEffect(() => {
    if (!session || !chat) {
      return undefined
    }
    const timer = setInterval(() => {
      void (async () => {
        try {
          await session.sweep(chat.id)
          setCurrent({ chatId: chat.id, value: session.view(chat.id) })
        } catch {
          // A local storage hiccup must not tear the chat down; the next tick retries.
        }
      })()
    }, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [session, chat])

  const sendText = async (text: string): Promise<boolean> => {
    if (!session || !chat || sending) {
      return false
    }
    setSending(true)
    try {
      await session.sendText(chat, text)
      setCurrent({ chatId: chat.id, value: session.view(chat.id) })
      setFailure(null)
      return true
    } catch (cause) {
      setFailure({
        chatId: chat.id,
        value: describeSecretError(cause, 'Сообщение не отправилось.'),
      })
      return false
    } finally {
      setSending(false)
    }
  }

  const sendFile = async (file: File): Promise<boolean> => {
    if (!session || !chat || sending) {
      return false
    }
    setSending(true)
    try {
      await session.sendFile(chat, file)
      setCurrent({ chatId: chat.id, value: session.view(chat.id) })
      setFailure(null)
      return true
    } catch (cause) {
      setFailure({
        chatId: chat.id,
        value: describeSecretError(cause, 'Файл не отправился.'),
      })
      return false
    } finally {
      setSending(false)
    }
  }

  const setTimer = async (seconds: SecretTimer): Promise<boolean> => {
    if (!session || !chat) {
      return false
    }
    try {
      await session.setTimer(chat, seconds)
      setCurrent({ chatId: chat.id, value: session.view(chat.id) })
      setFailure(null)
      return true
    } catch (cause) {
      setFailure({
        chatId: chat.id,
        value: describeSecretError(cause, 'Не удалось изменить таймер.'),
      })
      return false
    }
  }

  const setVerified = async (verified: boolean): Promise<boolean> => {
    if (!session || !chat) {
      return false
    }
    try {
      const next = await session.setVerified(chat, verified)
      setCurrent({ chatId: chat.id, value: next })
      setFailure(null)
      return true
    } catch (cause) {
      setFailure({
        chatId: chat.id,
        value: describeSecretError(cause, 'Не удалось сохранить отметку.'),
      })
      return false
    }
  }

  return {
    view,
    loading,
    error,
    session,
    chat,
    sending,
    actions: { sendText, sendFile, setTimer, setVerified },
  }
}
