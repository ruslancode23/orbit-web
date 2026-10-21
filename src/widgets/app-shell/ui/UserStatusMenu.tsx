import { type ReactNode } from 'react'

import { usePresenceActivityState, type PresenceChoice } from '@/entities/live'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { EditIcon } from '@/shared/ui/icon'

type VisibleStatus = Exclude<PresenceChoice, 'auto'>

interface StatusOption {
  value: VisibleStatus
  label: string
  dot: string
}

const STATUS_OPTIONS: readonly StatusOption[] = [
  { value: 'online', label: 'В сети', dot: 'bg-success' },
  { value: 'idle', label: 'Не активен', dot: 'bg-warning' },
  { value: 'dnd', label: 'Не беспокоить', dot: 'bg-danger' },
  { value: 'invisible', label: 'Невидимка', dot: 'bg-fg-muted' },
]

const LABEL: Record<VisibleStatus, string> = {
  online: 'В сети',
  idle: 'Не активен',
  dnd: 'Не беспокоить',
  invisible: 'Невидимка',
}

const isVisibleStatus = (value: string): value is VisibleStatus =>
  value === 'online' || value === 'idle' || value === 'dnd' || value === 'invisible'

interface UserStatusMenuProps {
  status: PresenceChoice
  onStatusChange: (status: VisibleStatus) => void
  onEditProfile: () => void
  /** The avatar and the name; the whole block opens the menu. */
  children: ReactNode
}

/**
 * The status menu behind the person at the bottom of the sidebar. `auto` is
 * not a menu item: the tick follows the tab while the status is automatic, and
 * picking an item pins that status until it is changed again. Radix gives the
 * radio group arrows, Enter and Esc, and returns the focus to the trigger.
 */
export const UserStatusMenu = ({
  status,
  onStatusChange,
  onEditProfile,
  children,
}: UserStatusMenuProps) => {
  const activity = usePresenceActivityState()
  const effective: VisibleStatus =
    status === 'auto' ? (activity === 'idle' ? 'idle' : 'online') : status

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none"
        >
          {children}
          {/* The visible name is already here, so the name of the control is
              built from it and this line: no aria-label to fall out of step. */}
          <span className="sr-only">Статус: «{LABEL[effective]}». Открыть меню статуса.</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" aria-label="Статус" className="w-56">
        <DropdownMenuLabel>Статус</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={effective}
          onValueChange={(next) => {
            if (isVisibleStatus(next)) {
              onStatusChange(next)
            }
          }}
        >
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <span aria-hidden="true" className={`size-2.5 rounded-full ${option.dot}`} />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onEditProfile}>
            <EditIcon className="size-4 text-fg-muted" />
            Редактировать профиль
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
