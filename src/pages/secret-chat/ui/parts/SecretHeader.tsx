import { useState } from 'react'

import type { SecretTimer } from '@/entities/secret-session'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { MoreIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'

import { LockIcon, ShieldIcon } from './icons'
import { SecretTimerMenu } from './SecretTimerMenu'

interface SecretHeaderProps {
  nickname: string
  timerSeconds: number
  onSecurity: () => void
  onTimer: (seconds: SecretTimer) => Promise<boolean>
  onDelete: () => Promise<boolean>
}

/** Names the chat and keeps the controls that explain and end its security close. */
export const SecretHeader = ({
  nickname,
  timerSeconds,
  onSecurity,
  onTimer,
  onDelete,
}: SecretHeaderProps) => {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="Действия с чатом">
                <MoreIcon />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setConfirmOpen(true)
                }}
              >
                Удалить секретный чат
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <p className="text-xs text-fg-muted">Только на этом устройстве</p>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Удалить секретный чат?</DialogTitle>
          <DialogDescription>
            Чат исчезнет у обоих, а ключи и сообщения на этом устройстве будут стёрты. Вернуть его
            нельзя. Обычный диалог с {nickname} останется.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              disabled={deleting}
              onClick={() => {
                setConfirmOpen(false)
              }}
            >
              Отмена
            </Button>
            <Button
              variant="danger"
              disabled={deleting}
              onClick={() => {
                setDeleting(true)
                void onDelete().finally(() => {
                  setDeleting(false)
                })
              }}
            >
              {deleting ? 'Удаляем…' : 'Удалить'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}
