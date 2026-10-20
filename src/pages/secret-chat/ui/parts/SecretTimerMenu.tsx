import type { SecretTimer } from '@/entities/secret-session'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { IconButton } from '@/shared/ui/icon-button'
import { useToast } from '@/shared/ui/toast'

import { ClockIcon } from './icons'

interface TimerOption {
  seconds: SecretTimer
  label: string
}

/** The labels the menu shows; 0 says what it is, not that a timer is off. */
const TIMER_OPTIONS: readonly TimerOption[] = [
  { seconds: 0, label: 'Выкл' },
  { seconds: 5, label: '5 секунд' },
  { seconds: 30, label: '30 секунд' },
  { seconds: 60, label: '1 минута' },
  { seconds: 3600, label: '1 час' },
  { seconds: 86_400, label: '1 день' },
  { seconds: 604_800, label: '1 неделя' },
]

const parseTimer = (value: string): SecretTimer | null => {
  const option = TIMER_OPTIONS.find((item) => String(item.seconds) === value)
  return option?.seconds ?? null
}

const labelFor = (seconds: SecretTimer): string => {
  return TIMER_OPTIONS.find((item) => item.seconds === seconds)?.label ?? ''
}

interface SecretTimerMenuProps {
  timerSeconds: number
  onSelect: (seconds: SecretTimer) => Promise<boolean>
}

/**
 * Picks for how long new messages live. A timer change is a message of its
 * own, so the peer learns about it and the local choice is stored at once.
 */
export const SecretTimerMenu = ({ timerSeconds, onSelect }: SecretTimerMenuProps) => {
  const toast = useToast()

  const choose = (value: string) => {
    const seconds = parseTimer(value)
    if (seconds === null) {
      return
    }
    void onSelect(seconds).then((saved) => {
      if (!saved) {
        return
      }
      toast(
        seconds === 0
          ? 'Таймер самоуничтожения выключен.'
          : `Таймер самоуничтожения: ${labelFor(seconds)}.`,
        'success',
      )
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label="Таймер самоуничтожения">
          <ClockIcon />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Таймер самоуничтожения</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={String(timerSeconds)} onValueChange={choose}>
          {TIMER_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.seconds} value={String(option.seconds)}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <p className="px-2 py-1 text-xs text-fg-muted">
          Отсчёт начнётся у отправителя сразу после отправки, а у получателя — после прочтения.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
