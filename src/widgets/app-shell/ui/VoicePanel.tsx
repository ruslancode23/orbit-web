import { useState } from 'react'

import { ParticipantCard } from '@/entities/participant'
import { useVoiceRoom, type VoiceParticipant, type VoiceRoomStatus } from '@/entities/voice-room'
import { useVoiceChannel } from '@/features/join-voice-channel'
import { ReconnectRoom } from '@/features/reconnect-room'
import { ShareScreenButton } from '@/features/share-screen'
import { Button } from '@/shared/ui/button'
import {
  HeadphonesIcon,
  HeadphonesOffIcon,
  MicIcon,
  MicOffIcon,
  VolumeIcon,
} from '@/shared/ui/icon'
import { Slider } from '@/shared/ui/slider'
import { Toggle } from '@/shared/ui/toggle'

const STATUS_TEXT: Partial<Record<VoiceRoomStatus, string>> = {
  connecting: 'Подключаемся…',
  connected: 'Подключено',
  reconnecting: 'Переподключаемся…',
  disconnected: 'Нет связи',
  error: 'Не удалось подключиться',
}

/**
 * The voice connection that survives moving between text channels and servers.
 * It sits at the bottom of the sidebar, as in Discord: the channel, who is in
 * it, the microphone and screen controls, and one way out.
 */
export const VoicePanel = () => {
  const { activeChannel, status, error, leave, reconnect, connecting } = useVoiceChannel()
  const { room, participants, setMicrophoneMuted, setDeafened, setParticipantVolume } =
    useVoiceRoom()
  const [actionError, setActionError] = useState<string | null>(null)

  if (!activeChannel) {
    return null
  }

  const me = participants.find((participant) => participant.isLocal)
  const isMuted = me?.isMicrophoneMuted ?? false
  const isDeafened = me?.isDeafened ?? false

  const run = async (action: () => Promise<void>) => {
    setActionError(null)
    try {
      await action()
    } catch {
      setActionError('Не удалось переключить микрофон. Проверьте, что он подключён.')
    }
  }

  return (
    <section
      aria-label="Голос подключён"
      className="flex max-h-96 flex-col gap-2 overflow-y-auto rounded-md border border-border bg-surface p-2"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold">
          <span aria-hidden="true">🔊 </span>
          {activeChannel.name}
        </h3>
        <span className="shrink-0 text-xs text-fg-muted">{STATUS_TEXT[status] ?? ''}</span>
      </header>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-xs text-danger">
          {actionError}
        </p>
      )}

      <ReconnectRoom onReconnect={reconnect} connecting={connecting} />

      {status === 'connecting' && (
        <p role="status" className="text-xs text-fg-muted">
          Подключаемся к голосовому каналу…
        </p>
      )}

      {room && (
        <>
          <div role="group" aria-label="Звук" className="flex gap-2">
            <Toggle
              size="icon"
              aria-label={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
              title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
              pressed={isMuted}
              onPressedChange={(muted) => void run(() => setMicrophoneMuted(muted))}
            >
              {isMuted ? <MicOffIcon /> : <MicIcon />}
            </Toggle>
            <Toggle
              size="icon"
              aria-label="Выключить звук"
              title="Выключить звук: вы никого не слышите, микрофон тоже выключается"
              pressed={isDeafened}
              onPressedChange={(deafened) => void run(() => setDeafened(deafened))}
            >
              {isDeafened ? <HeadphonesOffIcon /> : <HeadphonesIcon />}
            </Toggle>
          </div>

          <ul aria-label="Участники" className="flex flex-col gap-1">
            {participants.map((participant) => (
              <li key={participant.identity}>
                <ParticipantCard participant={participant}>
                  {!participant.isLocal && (
                    <ParticipantVolume
                      participant={participant}
                      onChange={(volume) => {
                        setParticipantVolume(participant.identity, volume)
                      }}
                    />
                  )}
                </ParticipantCard>
              </li>
            ))}
          </ul>

          <ShareScreenButton />
        </>
      )}

      <Button size="sm" variant="danger" onClick={() => void leave()}>
        Отключиться
      </Button>
    </section>
  )
}

const ParticipantVolume = ({
  participant,
  onChange,
}: {
  participant: VoiceParticipant
  onChange: (volume: number) => void
}) => {
  return (
    <div className="flex items-center gap-2 text-fg-muted">
      <VolumeIcon className="shrink-0" />
      <Slider
        aria-label={`Громкость: ${participant.name}`}
        value={[Math.round(participant.volume * 100)]}
        max={100}
        step={5}
        getValueText={(percent) => `${String(percent)} %`}
        onValueChange={([percent]) => {
          if (percent !== undefined) {
            onChange(percent / 100)
          }
        }}
      />
    </div>
  )
}
