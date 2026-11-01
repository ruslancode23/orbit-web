import { useId, useState } from 'react'

import { readScreenShareQuality, saveScreenShareQuality } from '@/entities/voice-room'
import type { ScreenShareQuality } from '@/shared/platform'

const RESOLUTIONS: readonly {
  value: ScreenShareQuality['resolution']
  label: string
  description: string
}[] = [
  {
    value: '720p',
    label: '720p',
    description: 'Меньше нагрузки на процессор и сеть — хватит для текста, кода и слайдов.',
  },
  {
    value: '1080p',
    label: '1080p',
    description: 'Чётче: мелкий текст и детали интерфейса видно без приближения.',
  },
]

const FRAME_RATES: readonly {
  value: ScreenShareQuality['frameRate']
  label: string
  description: string
}[] = [
  {
    value: 30,
    label: '30 кадров/с',
    description: 'Обычный режим: текст, слайды, код.',
  },
  {
    value: 60,
    label: '60 кадров/с',
    description: 'Плавно для видео, игр и прокрутки. Заметно больше нагрузки.',
  },
]

/**
 * "Качество демонстрации экрана": the resolution and frame rate the next share
 * asks the browser for. The choice is kept on this device; a share that is
 * already running keeps the capture it started with.
 */
export const ScreenShareSettings = () => {
  const [quality, setQuality] = useState(readScreenShareQuality)
  const id = useId()

  const choose = (next: ScreenShareQuality) => {
    setQuality(next)
    saveScreenShareQuality(next)
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Качество демонстрации экрана</h3>

      <fieldset className="flex flex-col gap-0.5">
        <legend className="mb-1 text-sm">Разрешение</legend>
        {RESOLUTIONS.map((resolution) => {
          const optionId = `${id}-resolution-${resolution.value}`
          return (
            <div
              key={resolution.value}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover"
            >
              <input
                id={optionId}
                type="radio"
                name={`${id}-resolution`}
                value={resolution.value}
                checked={quality.resolution === resolution.value}
                aria-describedby={`${optionId}-hint`}
                onChange={() => {
                  choose({ ...quality, resolution: resolution.value })
                }}
                className="mt-0.5 size-4 shrink-0 accent-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              />
              <label htmlFor={optionId} className="flex min-w-0 cursor-pointer flex-col">
                <span className="text-sm text-fg">{resolution.label}</span>
                <span id={`${optionId}-hint`} className="text-xs text-fg-muted">
                  {resolution.description}
                </span>
              </label>
            </div>
          )
        })}
      </fieldset>

      <fieldset className="flex flex-col gap-0.5">
        <legend className="mb-1 text-sm">Частота кадров</legend>
        {FRAME_RATES.map((rate) => {
          const optionId = `${id}-frame-rate-${String(rate.value)}`
          return (
            <div
              key={rate.value}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover"
            >
              <input
                id={optionId}
                type="radio"
                name={`${id}-frame-rate`}
                value={rate.value}
                checked={quality.frameRate === rate.value}
                aria-describedby={`${optionId}-hint`}
                onChange={() => {
                  choose({ ...quality, frameRate: rate.value })
                }}
                className="mt-0.5 size-4 shrink-0 accent-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              />
              <label htmlFor={optionId} className="flex min-w-0 cursor-pointer flex-col">
                <span className="text-sm text-fg">{rate.label}</span>
                <span id={`${optionId}-hint`} className="text-xs text-fg-muted">
                  {rate.description}
                </span>
              </label>
            </div>
          )
        })}
      </fieldset>

      <p className="px-2 text-xs text-fg-muted">
        Применится к следующей демонстрации. Браузер может отдать меньше, если экран меньше или не
        успевает.
      </p>
    </section>
  )
}
