import { useId } from 'react'

import {
  useVoiceRoom,
  type AudioProcessing,
  type NoiseSuppressionMode,
} from '@/entities/voice-room'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'
import { useToast } from '@/shared/ui/toast'

const NOISE_MODES: readonly { value: NoiseSuppressionMode; label: string; description: string }[] =
  [
    {
      value: 'off',
      label: 'Выключено',
      description: 'Звук идёт как есть — для студийного микрофона или музыки.',
    },
    {
      value: 'standard',
      label: 'Стандартное',
      description: 'Встроенное в браузер: глушит постоянный фон — вентилятор, гул.',
    },
    {
      value: 'enhanced',
      label: 'Усиленное',
      description:
        'Нейросеть RNNoise на вашем устройстве: убирает клавиатуру, шум улицы, голоса фоном. Чуть больше нагрузки на процессор.',
    },
  ]

const SWITCHES: readonly {
  name: Exclude<keyof AudioProcessing, 'noiseSuppression'>
  label: string
  hint: string
}[] = [
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
 * Noise suppression (off, the browser's, RNNoise) and the browser's other
 * processing of the microphone. Every change applies at once, in the running
 * call too; the choice is kept on this device.
 */
export const AudioProcessingSettings = () => {
  const {
    audioProcessing,
    setAudioProcessing,
    noiseSuppressionMode,
    setNoiseSuppressionMode,
    enhancedNoiseSuppressionUnavailable,
  } = useVoiceRoom()
  const toast = useToast()
  const id = useId()

  const failed = () => {
    toast('Не удалось применить настройку к микрофону.', 'danger')
  }

  const toggle = (name: keyof AudioProcessing, enabled: boolean) => {
    void setAudioProcessing({ ...audioProcessing, [name]: enabled }).catch(failed)
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Обработка звука</h3>

      <fieldset className="flex flex-col gap-0.5">
        <legend className="mb-1 text-sm">Шумоподавление</legend>
        {NOISE_MODES.map((mode) => {
          const optionId = `${id}-noise-${mode.value}`
          return (
            <div
              key={mode.value}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover"
            >
              <input
                id={optionId}
                type="radio"
                name={`${id}-noise`}
                value={mode.value}
                checked={noiseSuppressionMode === mode.value}
                aria-describedby={`${optionId}-hint`}
                onChange={() => {
                  void setNoiseSuppressionMode(mode.value).catch(failed)
                }}
                className="mt-0.5 size-4 shrink-0 accent-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              />
              <label htmlFor={optionId} className="flex min-w-0 cursor-pointer flex-col">
                <span className="text-sm text-fg">{mode.label}</span>
                <span id={`${optionId}-hint`} className="text-xs text-fg-muted">
                  {mode.description}
                </span>
              </label>
            </div>
          )
        })}
        {enhancedNoiseSuppressionUnavailable && (
          <p role="alert" className="px-2 text-xs text-danger">
            Усиленное шумоподавление не запустилось в этом браузере — включено стандартное.
          </p>
        )}
      </fieldset>

      {SWITCHES.map(({ name, label, hint }) => (
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
