import { useState } from 'react'

import { ParticipantCard } from '@/entities/participant'
import { useVoiceRoom, type VoiceParticipant } from '@/entities/voice-room'
import {
  HeadphonesIcon,
  HeadphonesOffIcon,
  MicIcon,
  MicOffIcon,
  VolumeIcon,
} from '@/shared/ui/icon'
import { Slider } from '@/shared/ui/slider'
import { Toggle } from '@/shared/ui/toggle'

/** Who is in the room and who is speaking, with mute, deafen and per-participant volume. */
export const VoiceRoom = () => {
  const { room, participants, setMicrophoneMuted, setDeafened, setParticipantVolume } =
    useVoiceRoom()
  const [error, setError] = useState<string | null>(null)

  if (!room) {
    return null
  }

  const me = participants.find((p) => p.isLocal)
  const isMuted = me?.isMicrophoneMuted ?? false
  const isDeafened = me?.isDeafened ?? false

  const run = async (action: () => Promise<void>) => {
    setError(null)
    try {
      await action()
    } catch {
      setError('Не удалось включить микрофон. Проверьте, что он подключён и доступен браузеру.')
    }
  }

  return (
    <section aria-label="Голосовая комната" className="flex w-full flex-col gap-3">
      <div role="group" aria-label="Звук" className="flex gap-2">
        <Toggle
          size="icon"
          aria-label="Выключить микрофон"
          title="Выключить микрофон"
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
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
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
