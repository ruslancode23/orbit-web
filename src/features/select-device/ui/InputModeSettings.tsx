import { useId, useState, type KeyboardEvent } from 'react'

import { describeKey, RESERVED_KEYS, useVoiceRoom, type InputMode } from '@/entities/voice-room'
import { Button } from '@/shared/ui/button'
import { useToast } from '@/shared/ui/toast'

const MODES: readonly { value: InputMode; label: string; description: string }[] = [
  {
    value: 'voice-activity',
    label: 'Голосовая активация',
    description: 'Микрофон передаёт звук, когда вы говорите.',
  },
  {
    value: 'push-to-talk',
    label: 'По нажатию клавиши',
    description:
      'Микрофон открыт, только пока клавиша зажата. Собеседники не слышат фон между фразами.',
  },
]

/**
 * "Режим ввода": voice activity or push-to-talk, and the key for it. The key
 * is picked by pressing it; Esc cancels. The browser only lets the page see
 * keys while Orbit is the active tab, and the hint says so.
 */
export const InputModeSettings = () => {
  const { inputMode, setInputMode, pushToTalkKey, setPushToTalkKey } = useVoiceRoom()
  const toast = useToast()
  const id = useId()
  const [capturing, setCapturing] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  // Space is pressed on keyup: the key just chosen must not press the button again.
  const [justChosen, setJustChosen] = useState<string | null>(null)

  const chooseMode = (mode: InputMode) => {
    void setInputMode(mode).catch(() => {
      toast('Не удалось переключить микрофон.', 'danger')
    })
  }

  const captureKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!capturing) {
      return
    }
    // The key is being chosen, not used: it must not reach push-to-talk or close the dialog.
    event.preventDefault()
    event.stopPropagation()
    if (event.code === 'Escape') {
      setCapturing(false)
      setRefusal(null)
      return
    }
    if (RESERVED_KEYS.has(event.code)) {
      setRefusal(`${describeKey(event.code)} занята интерфейсом — выберите другую клавишу.`)
      return
    }
    setPushToTalkKey(event.code)
    setJustChosen(event.code)
    setCapturing(false)
    setRefusal(null)
  }

  const swallowChosenKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.code === justChosen) {
      event.preventDefault()
      setJustChosen(null)
    }
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">Режим ввода</legend>
      <div className="flex flex-col gap-0.5">
        {MODES.map((mode) => {
          const optionId = `${id}-${mode.value}`
          return (
            <div
              key={mode.value}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover"
            >
              <input
                id={optionId}
                type="radio"
                name={`${id}-input-mode`}
                value={mode.value}
                checked={inputMode === mode.value}
                aria-describedby={`${optionId}-hint`}
                onChange={() => {
                  chooseMode(mode.value)
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
      </div>

      {inputMode === 'push-to-talk' && (
        <div className="flex flex-col gap-1 px-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">Клавиша</span>
            <kbd className="rounded border border-border bg-surface-hover px-2 py-0.5 font-mono text-sm">
              {describeKey(pushToTalkKey)}
            </kbd>
            <Button
              size="sm"
              variant="secondary"
              aria-describedby={`${id}-key-hint`}
              onClick={() => {
                setCapturing(true)
                setRefusal(null)
              }}
              onKeyDown={captureKey}
              onKeyUp={swallowChosenKey}
              onBlur={() => {
                setCapturing(false)
              }}
            >
              {capturing ? 'Нажмите клавишу…' : 'Изменить клавишу'}
            </Button>
          </div>
          {refusal && (
            <p role="alert" className="text-xs text-danger">
              {refusal}
            </p>
          )}
          <p id={`${id}-key-hint`} className="text-xs text-fg-muted">
            {capturing
              ? 'Esc — отмена.'
              : 'Работает, пока вкладка Orbit открыта и активна. Отпущенная клавиша закрывает микрофон через 0,2 с.'}
          </p>
        </div>
      )}
    </fieldset>
  )
}
