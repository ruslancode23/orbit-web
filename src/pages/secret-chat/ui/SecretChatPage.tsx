import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'

import { useLive } from '@/entities/live'
import { useSecretChats, useSecretDevice } from '@/entities/secret-chat'
import { useSession } from '@/entities/session'
import { getPlatform } from '@/shared/platform'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

import { useSecretChat } from '../model/useSecretChat'
import { LockIcon } from './parts/icons'
import { SecretComposer } from './parts/SecretComposer'
import { SecretHeader } from './parts/SecretHeader'
import { SecretMessages } from './parts/SecretMessages'
import { EncryptionDetailsDialog, SecurityDialog } from './parts/SecurityDialog'

import type { SecretChatPageDeps, SecretChatSession } from '../model/useSecretChat'

const DEVICE_NAME = 'Этот браузер'

const BANNER_TEXT =
  'Сообщения зашифрованы на ваших устройствах. Сервер Orbit не может их прочитать. Чат доступен только на этом устройстве'

const NOT_FOUND_TEXT = 'Секретный чат не найден'

/** Loads libolm only when a chat is actually opened. */
const openSecretSession = async (userId: string): Promise<SecretChatSession> => {
  const { SecretSession, serverSecretApi } = await import('@/entities/secret-session')
  return SecretSession.open(serverSecretApi, getPlatform().secretStore, userId, DEVICE_NAME)
}

/**
 * The route `/dm/s/:secretChatId`: resolves the device and its chats with the
 * shared queries, then hands them to the screen. A test can skip this wrapper
 * by passing `deps` directly, without mocking the crypto core.
 */
const LiveSecretChatPage = () => {
  const { secretChatId } = useParams()
  const { data: device, isLoading: isDeviceLoading, refetch: refetchDevice } = useSecretDevice()
  const { data: chats, isLoading: isChatsLoading } = useSecretChats(device?.deviceId)
  const { user } = useSession()
  const { listen } = useLive()
  const userId = user?.id

  // The device query caches "no device" forever, but starting a chat may have
  // registered one since. Re-read the store once before calling the route dead.
  useEffect(() => {
    if (!isDeviceLoading && device === null) {
      void refetchDevice()
    }
  }, [device, isDeviceLoading, refetchDevice])

  const deps = useMemo<SecretChatPageDeps>(
    () => ({
      secretChatId,
      device,
      chats,
      isDeviceLoading,
      isChatsLoading,
      userId,
      listen,
      openSession: openSecretSession,
    }),
    [secretChatId, device, chats, isDeviceLoading, isChatsLoading, userId, listen],
  )

  return <SecretChatScreen deps={deps} />
}

const SecretChatScreen = ({ deps }: { deps: SecretChatPageDeps }) => {
  const { view, loading, error, chat, sending, actions } = useSecretChat(deps)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const openSecurity = () => {
    setSecurityOpen(true)
  }

  if (loading) {
    return <SecretChatSkeleton />
  }
  if (!chat) {
    return (
      <SecretChatUnavailable
        title={NOT_FOUND_TEXT}
        text="Возможно, он открыт на другом устройстве или ещё не создан."
      />
    )
  }
  if (!view) {
    return (
      <SecretChatUnavailable
        title="Не удалось открыть секретный чат"
        text={error ?? 'Попробуйте обновить страницу.'}
      />
    )
  }

  const blocked = view.keyChanged && !view.verified

  return (
    <section aria-label="Секретный чат" className="flex min-h-0 flex-1 flex-col">
      <SecretHeader
        nickname={chat.peer.nickname}
        timerSeconds={view.timerSeconds}
        onSecurity={openSecurity}
        onTimer={actions.setTimer}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div
          role="note"
          className="mx-4 mt-4 flex items-start gap-3 rounded-panel border border-border bg-surface p-3"
        >
          <LockIcon className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          <p className="min-w-0 flex-1 text-sm text-fg-muted">{BANNER_TEXT}</p>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setDetailsOpen(true)
            }}
          >
            Подробнее
          </Button>
        </div>

        {error !== null && (
          <p
            role="alert"
            className="mx-4 mt-3 rounded-panel border border-danger/60 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        )}

        {blocked && (
          <div
            role="alert"
            className="mx-4 mt-3 flex flex-col gap-2 rounded-panel border border-danger/60 bg-danger/10 p-3"
          >
            <p className="text-sm font-medium text-danger">Ключ шифрования собеседника изменился</p>
            <p className="text-sm text-fg-muted">
              Сообщения заблокированы, пока вы не сверите код безопасности и не отметите его
              проверенным снова.
            </p>
            <Button variant="secondary" size="sm" className="self-start" onClick={openSecurity}>
              Шифрование
            </Button>
          </div>
        )}

        <SecretMessages messages={view.messages} />
      </div>

      <SecretComposer
        disabled={blocked}
        sending={sending}
        onSendText={actions.sendText}
        onSendFile={actions.sendFile}
      />

      <SecurityDialog
        open={securityOpen}
        onOpenChange={setSecurityOpen}
        view={view}
        onVerified={actions.setVerified}
      />
      <EncryptionDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} />
    </section>
  )
}

const SecretChatSkeleton = () => {
  return (
    <section aria-label="Секретный чат" className="flex min-h-0 flex-1 flex-col">
      <div
        role="status"
        aria-label="Загружаем секретный чат"
        className="flex flex-1 flex-col gap-4 p-4"
      >
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-12 w-1/2 self-end" />
      </div>
    </section>
  )
}

const SecretChatUnavailable = ({ title, text }: { title: string; text: string }) => {
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-3 px-6 text-center">
      <LockIcon className="size-8 text-fg-muted" />
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-fg-muted">{text}</p>
    </div>
  )
}

interface SecretChatPageProps {
  /** Injected by a test; the route renders the page without it. */
  deps?: SecretChatPageDeps
}

const SecretChatPage = ({ deps }: SecretChatPageProps) => {
  if (deps) {
    return <SecretChatScreen deps={deps} />
  }
  return <LiveSecretChatPage />
}

export default SecretChatPage
