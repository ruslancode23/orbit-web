import { useState } from 'react'

import { useVoiceRoom } from '@/entities/voice-room'
import {
  readDevicePreferences,
  saveMicrophoneId,
  saveSpeakerId,
} from '@/shared/lib/device-preference'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { ChevronDownIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { useToast } from '@/shared/ui/toast'

import { DEFAULT_DEVICE, deviceLabel, useAudioDevices } from '../model/useAudioDevices'

interface DeviceMenuProps {
  kind: 'audioinput' | 'audiooutput'
}

/** The quick device list behind the chevron next to the microphone or sound button. */
export const DeviceMenu = ({ kind }: DeviceMenuProps) => {
  const devices = useAudioDevices()
  const { room } = useVoiceRoom()
  const toast = useToast()
  const [preferences, setPreferences] = useState(readDevicePreferences)

  const isMicrophone = kind === 'audioinput'
  const items = isMicrophone ? devices.microphones : devices.speakers
  const supported = isMicrophone || devices.canSelectOutput
  const selected =
    (isMicrophone ? preferences.microphoneId : preferences.speakerId) ?? DEFAULT_DEVICE
  const label = isMicrophone ? 'Выбрать микрофон' : 'Выбрать динамики'

  const choose = (value: string) => {
    const id = value === DEFAULT_DEVICE ? undefined : value
    if (isMicrophone) {
      saveMicrophoneId(id)
      setPreferences((current) => ({ ...current, microphoneId: id }))
    } else {
      saveSpeakerId(id)
      setPreferences((current) => ({ ...current, speakerId: id }))
    }
    if (!room) {
      return
    }
    void room.switchActiveDevice(kind, id ?? DEFAULT_DEVICE).then((switched) => {
      if (!switched) {
        toast(
          isMicrophone ? 'Не удалось переключить микрофон.' : 'Не удалось переключить динамики.',
          'danger',
        )
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={label} size="sm" className="size-5">
          <ChevronDownIcon className="size-3" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-64">
        <DropdownMenuLabel>{isMicrophone ? 'Микрофон' : 'Динамики'}</DropdownMenuLabel>
        {!supported ? (
          <p className="px-2 pb-1 text-xs text-fg-muted">
            Браузер выводит звук на системное устройство.
          </p>
        ) : items.length === 0 ? (
          <p className="px-2 pb-1 text-xs text-fg-muted">Устройства не найдены.</p>
        ) : (
          <DropdownMenuRadioGroup value={selected} onValueChange={choose}>
            <DropdownMenuRadioItem value={DEFAULT_DEVICE}>По умолчанию</DropdownMenuRadioItem>
            {items.map((device, index) => (
              <DropdownMenuRadioItem key={device.deviceId} value={device.deviceId}>
                {deviceLabel(device, index)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
        {!devices.labelsVisible && (
          <p className="px-2 pt-1 text-xs text-fg-muted">
            Названия появятся после доступа к микрофону.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
