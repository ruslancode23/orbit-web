import { useId } from 'react'

import { useVoiceRoom, type AudioProcessing } from '@/entities/voice-room'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'
import { useToast } from '@/shared/ui/toast'

const OPTIONS: readonly { name: keyof AudioProcessing; label: string; hint: string }[] = [
  {
    name: 'noiseSuppression',
    label: 'Шумоподавление',
    hint: 'Глушит постоянный фон: вентилятор, гул, шум улицы.',
  },
  {
    name: 'echoCancellation',
    label: 'Эхоподавление',
    hint: 'Не даёт собеседникам слышать самих себя из ваших динамиков. Выключайте только в наушниках.',
  },
  {
    name: 'autoGainControl',
    label: 'Автоматическая громкость',
    hint: 'Выравнивает громкость голоса. Выключите, если микрофон уже настроен или вы играете музыку.',
  },
]

/**
 * The browser's own processing of the microphone. A switch applies at once,
 * in the running call too; the choice is kept on this device.
 */
export const AudioProcessingSettings = () => {
  const { audioProcessing, setAudioProcessing } = useVoiceRoom()
  const toast = useToast()
  const id = useId()

  const toggle = (name: keyof AudioProcessing, enabled: boolean) => {
    void setAudioProcessing({ ...audioProcessing, [name]: enabled }).catch(() => {
      toast('Не удалось применить настройку к микрофону.', 'danger')
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Обработка звука</h3>
      {OPTIONS.map(({ name, label, hint }) => (
        <div key={name} className="flex items-start gap-3">
          <Switch
            id={`${id}-${name}`}
            checked={audioProcessing[name]}
            onCheckedChange={(enabled) => {
              toggle(name, enabled)
            }}
            aria-describedby={`${id}-${name}-hint`}
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`${id}-${name}`}>{label}</Label>
            <p id={`${id}-${name}-hint`} className="text-xs text-fg-muted">
              {hint}
            </p>
          </div>
        </div>
      ))}
    </section>
  )
}
