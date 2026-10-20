import { Link } from 'react-router'

import { useVoiceRoom, type VoiceRoomStatus } from '@/entities/voice-room'
import { useVoiceChannel } from '@/features/join-voice-channel'
import { ShareScreenButton } from '@/features/share-screen'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import { PhoneOffIcon, SignalIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'

const SIGNAL: Record<VoiceRoomStatus, { text: string; className: string }> = {
  idle: { text: 'Не подключено', className: 'text-fg-muted' },
  connecting: { text: 'Подключаемся…', className: 'text-warning' },
  connected: { text: 'Подключено', className: 'text-success' },
  reconnecting: { text: 'Переподключаемся…', className: 'text-warning' },
  disconnected: { text: 'Нет связи', className: 'text-danger' },
  error: { text: 'Не удалось подключиться', className: 'text-danger' },
}

/**
 * One line at the bottom of the channel column: the connection, the channel it
 * is for, the screen and the way out. Mute, deafen and the devices live in the
 * user panel right below; who is in the channel is in the member column.
 */
export const VoicePanel = () => {
  const { activeChannel, status, error, leave, reconnect, connecting, connectionLoss } =
    useVoiceChannel()
  const { isSharingScreen } = useVoiceRoom()

  if (!activeChannel) {
    return null
  }

  const signal = SIGNAL[status]

  return (
    <section
      aria-label="Голос подключён"
      className="flex flex-col gap-1 rounded-md border border-border bg-surface p-2"
    >
      <div className="flex items-center gap-2">
        <span title={signal.text} className={cn('shrink-0', signal.className)}>
          <SignalIcon />
          <span className="sr-only">{signal.text}</span>
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-[11px] leading-tight text-fg-muted">Голос подключён</p>
          <Link
            to={`/s/${activeChannel.workspaceId}/${activeChannel.id}`}
            className="truncate text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {activeChannel.name}
          </Link>
        </div>
        <ShareScreenButton />
        <IconButton
          label="Отключиться"
          variant="danger"
          onClick={() => void leave()}
          tooltip={isSharingScreen ? 'Отключиться (показ экрана остановится)' : 'Отключиться'}
        >
          <PhoneOffIcon />
        </IconButton>
      </div>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      {connectionLoss && (
        <div role="alert" className="flex flex-col gap-1 text-xs text-danger">
          <span>{connectionLoss.message}</span>
          {connectionLoss.canRetry && (
            <Button
              size="sm"
              variant="secondary"
              className="self-start"
              disabled={connecting}
              onClick={() => void reconnect()}
            >
              {connecting ? 'Переподключаемся…' : 'Переподключиться'}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
