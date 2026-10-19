import { useMutation } from '@tanstack/react-query'

import { useVoiceRoom } from '@/entities/voice-room'
import { createVoiceTokenMutation, isApiError } from '@/shared/api'
import { Button } from '@/shared/ui/button'

interface ReconnectRoomProps {
  room: string
}

/**
 * Tells the user the connection dropped while LiveKit retries on its own, and if it gives up,
 * explains why and offers to join again with a fresh token.
 */
export const ReconnectRoom = ({ room }: ReconnectRoomProps) => {
  const { status, connectionLoss, join } = useVoiceRoom()
  const tokenMutation = useMutation(createVoiceTokenMutation())

  if (status === 'reconnecting') {
    return (
      <div role="status" className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
        <p className="font-medium">Связь прервалась</p>
        <p className="text-fg-muted">Пробуем вернуться в комнату — голос и экран вернутся сами.</p>
      </div>
    )
  }

  if (status !== 'disconnected' || !connectionLoss) return null

  const busy = tokenMutation.isPending

  const rejoin = async () => {
    if (busy) return
    const token = await tokenMutation
      .mutateAsync({ body: { room, displayName: connectionLoss.displayName } })
      .catch(() => null)
    if (token) await join({ url: token.url, token: token.token })
  }

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md border border-danger bg-surface px-3 py-2 text-sm"
    >
      <p className="font-medium text-danger">Вы не в комнате</p>
      <p>{connectionLoss.message}</p>
      {connectionLoss.canRetry && (
        <>
          <p className="text-fg-muted">Проверьте подключение к интернету и попробуйте снова.</p>
          {tokenMutation.error && (
            <p className="text-danger">{describeTokenError(tokenMutation.error)}</p>
          )}
          <Button disabled={busy} onClick={() => void rejoin()}>
            {busy ? 'Переподключаемся…' : 'Переподключиться'}
          </Button>
        </>
      )}
    </div>
  )
}

const describeTokenError = (error: unknown): string => {
  if (isApiError(error) && error.isNetworkError) return 'Нет соединения с сервером.'
  return 'Сервер не смог выдать доступ в комнату.'
}
