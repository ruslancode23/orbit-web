import { useState } from 'react'

import { useVoiceRoom } from '@/entities/voice-room'
import {
  readDevicePreferences,
  saveMicrophoneId,
  saveSpeakerId,
} from '@/shared/lib/device-preference'
import { getPlatform } from '@/shared/platform'
import { Button } from '@/shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/shared/ui/select'
import { useToast } from '@/shared/ui/toast'

import { AudioProcessingSettings } from './AudioProcessingSettings'
import { InputModeSettings } from './InputModeSettings'
import { ScreenShareSettings } from './ScreenShareSettings'
import { DEFAULT_DEVICE, deviceLabel, useAudioDevices } from '../model/useAudioDevices'
import { useDeviceFallback } from '../model/useDeviceFallback'
import { useMicrophoneLevel } from '../model/useMicrophoneLevel'

/**
 * "Голос и видео": the microphone and the speakers, with a level meter and a
 * test sound. Switches happen in the running room through LiveKit, so nothing
 * reconnects; without a room the choice is simply remembered for the next join.
 */
export const DeviceSettings = () => {
  const devices = useAudioDevices()
  const { room, isMicrophoneMuted } = useVoiceRoom()
  const toast = useToast()
  const [microphoneId, setMicrophoneId] = useState(() => readDevicePreferences().microphoneId)
  const [speakerId, setSpeakerId] = useState(() => readDevicePreferences().speakerId)
  const [testing, setTesting] = useState(false)
  const level = useMicrophoneLevel(room)

  const microphonePresent =
    microphoneId === undefined ||
    devices.microphones.some((device) => device.deviceId === microphoneId)
  const speakerPresent =
    speakerId === undefined || devices.speakers.some((device) => device.deviceId === speakerId)
  const ready = !devices.loading && devices.labelsVisible

  useDeviceFallback({
    id: microphoneId,
    present: microphonePresent,
    ready,
    room,
    kind: 'audioinput',
    missingMessage: 'Микрофон больше не подключён — выбран по умолчанию.',
  })
  useDeviceFallback({
    id: speakerId,
    present: speakerPresent,
    ready,
    room,
    kind: 'audiooutput',
    missingMessage: 'Динамики больше не подключены — выбраны по умолчанию.',
  })

  const chooseMicrophone = (value: string) => {
    const id = value === DEFAULT_DEVICE ? undefined : value
    setMicrophoneId(id)
    saveMicrophoneId(id)
    if (!room) {
      return
    }
    void room.switchActiveDevice('audioinput', id ?? DEFAULT_DEVICE).then((switched) => {
      if (!switched) {
        toast('Не удалось переключить микрофон.', 'danger')
      }
    })
  }

  const chooseSpeaker = (value: string) => {
    const id = value === DEFAULT_DEVICE ? undefined : value
    setSpeakerId(id)
    saveSpeakerId(id)
    if (!room) {
      return
    }
    void room.switchActiveDevice('audiooutput', id ?? DEFAULT_DEVICE).then((switched) => {
      if (!switched) {
        toast('Не удалось переключить динамики.', 'danger')
      }
    })
  }

  const requestAccess = async () => {
    const granted = await devices.requestAccess()
    if (!granted) {
      toast('Браузер не дал доступ к микрофону.', 'danger')
    }
  }

  const playTestSound = async () => {
    setTesting(true)
    try {
      await getPlatform().mediaDevices.playTestSound(speakerId ?? null)
    } catch {
      toast('Не удалось воспроизвести звук.', 'danger')
    } finally {
      setTesting(false)
    }
  }

  const microphoneHint = !room
    ? 'Подключитесь к голосовому каналу, чтобы проверить уровень'
    : isMicrophoneMuted
      ? 'Микрофон выключен'
      : level > 0.02
        ? 'Звук идёт'
        : 'Тишина'

  const microphoneValue = microphonePresent && microphoneId ? microphoneId : DEFAULT_DEVICE
  const speakerValue = speakerPresent && speakerId ? speakerId : DEFAULT_DEVICE

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Микрофон</h3>
        <Select value={microphoneValue} onValueChange={chooseMicrophone}>
          <SelectTrigger aria-label="Микрофон">
            <span className="truncate">{selectedLabel(devices.microphones, microphoneValue)}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_DEVICE}>По умолчанию</SelectItem>
            {devices.microphones.map((device, index) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {deviceLabel(device, index)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!devices.labelsVisible && (
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              variant="secondary"
              className="self-start"
              disabled={devices.loading}
              onClick={() => void requestAccess()}
            >
              Разрешить доступ
            </Button>
            <p className="text-xs text-fg-muted">
              Пока браузер не получил доступ к микрофону, названия устройств скрыты.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <div
            role="meter"
            aria-label="Уровень микрофона"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level * 100)}
            className="h-2 w-full overflow-hidden rounded-full bg-surface-hover"
          >
            <div
              className="h-full rounded-full bg-success transition-[width] duration-100"
              style={{ width: `${String(Math.round(level * 100))}%` }}
            />
          </div>
          <span className="text-xs text-fg-muted">{microphoneHint}</span>
        </div>
      </section>

      <InputModeSettings />

      <AudioProcessingSettings />

      <ScreenShareSettings />

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Динамики</h3>
        {devices.canSelectOutput ? (
          <Select value={speakerValue} onValueChange={chooseSpeaker}>
            <SelectTrigger aria-label="Динамики">
              <span className="truncate">{selectedLabel(devices.speakers, speakerValue)}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_DEVICE}>По умолчанию</SelectItem>
              {devices.speakers.map((device, index) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {deviceLabel(device, index)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs text-fg-muted">
            Этот браузер выводит звук на системное устройство — выбрать динамики в нём нельзя.
          </p>
        )}
        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          disabled={testing}
          onClick={() => void playTestSound()}
        >
          {testing ? 'Проверяем…' : 'Проверить звук'}
        </Button>
        <p className="text-xs text-fg-muted">
          Короткий сигнал уйдёт в выбранные динамики. Если его не слышно, проверьте звук системы.
        </p>
      </section>
    </div>
  )
}

/** The visible text of a select: the chosen device's name, or the system default. */
const selectedLabel = (devices: MediaDeviceInfo[], value: string): string => {
  if (value === DEFAULT_DEVICE) {
    return 'По умолчанию'
  }
  const index = devices.findIndex((device) => device.deviceId === value)
  const device = devices[index]
  return device === undefined ? 'По умолчанию' : deviceLabel(device, index)
}
