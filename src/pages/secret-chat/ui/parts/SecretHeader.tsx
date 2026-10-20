import type { SecretTimer } from '@/entities/secret-session'
import { IconButton } from '@/shared/ui/icon-button'

import { LockIcon, ShieldIcon } from './icons'
import { SecretTimerMenu } from './SecretTimerMenu'

interface SecretHeaderProps {
  nickname: string
  timerSeconds: number
  onSecurity: () => void
  onTimer: (seconds: SecretTimer) => Promise<boolean>
}

/** Names the chat and keeps the two controls that explain its security close. */
export const SecretHeader = ({
  nickname,
  timerSeconds,
  onSecurity,
  onTimer,
}: SecretHeaderProps) => {
  return (
    <header className="flex shrink-0 flex-col gap-0.5 border-b border-border px-4 py-2 max-lg:pl-14">
      <div className="flex items-center gap-2">
        <LockIcon className="size-4 shrink-0 text-fg-muted" />
        <h1 className="min-w-0 truncate text-sm font-semibold">{nickname}</h1>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <IconButton label="Шифрование" onClick={onSecurity}>
            <ShieldIcon />
          </IconButton>
          <SecretTimerMenu timerSeconds={timerSeconds} onSelect={onTimer} />
        </div>
      </div>
      <p className="text-xs text-fg-muted">Только на этом устройстве</p>
    </header>
  )
}
