import { useVoiceRoom } from '@/entities/voice-room'
import { Button } from '@/shared/ui/button'

interface ReconnectRoomProps {
  onReconnect: () => Promise<void>
  connecting: boolean
}

/**
 * Tells the reader that LiveKit is retrying on its own, and when it gives up,
 * offers a fresh token for the same voice channel.
 */
export const ReconnectRoom = ({ onReconnect, connecting }: ReconnectRoomProps) => {
  const { activeChannel, status, connectionLoss } = useVoiceRoom()

  if (status === 'reconnecting') {
    return (
      <div role="status" className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
        <p className="font-medium">Связь прервалась</p>
        <p className="text-fg-muted">Пробуем вернуться — голос и экран вернутся сами.</p>
      </div>
    )
  }

  if (!activeChannel || status !== 'disconnected' || !connectionLoss) {
    return null
  }

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md border border-danger bg-surface px-3 py-2 text-sm"
    >
      <p className="font-medium text-danger">Вы не в канале</p>
      <p>{connectionLoss.message}</p>
      {connectionLoss.canRetry && (
        <>
          <p className="text-fg-muted">Проверьте подключение к интернету и попробуйте снова.</p>
          <Button disabled={connecting} onClick={() => void onReconnect()}>
            {connecting ? 'Переподключаемся…' : 'Переподключиться'}
          </Button>
        </>
      )}
    </div>
  )
}
