import { type ReactNode } from 'react'

import { type PresenceChoice } from '@/entities/live'
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
import { BugIcon, EditIcon, PlusIcon, SmileIcon } from '@/shared/ui/icon'

import {
  STATUS_DOT,
  STATUS_LABEL,
  useEffectiveStatus,
  type VisibleStatus,
} from '../model/my-status'

const STATUS_OPTIONS: readonly VisibleStatus[] = ['online', 'idle', 'dnd', 'invisible']

const isVisibleStatus = (value: string): value is VisibleStatus =>
  value === 'online' || value === 'idle' || value === 'dnd' || value === 'invisible'

interface UserStatusMenuProps {
  status: PresenceChoice
  onStatusChange: (status: VisibleStatus) => void
  /** Absent for a guest, whose card explains how to get an editable profile. */
  onEditProfile?: () => void
  onSetStatus: () => void
  /** The emoji and text shown next to the name, or '' when there is none. */
  signature: string
  /** Opens the profile settings; only offered while the account has no picture. */
  onAddPhoto?: () => void
  /** Opens the bug report form. */
  onReportBug: () => void
  /** The avatar and the name; the whole block opens the menu. */
  children: ReactNode
}

/**
 * The status menu behind the person at the bottom of the sidebar: the
 * presence (online, idle, do not disturb, invisible) and the signature — the
 * emoji and text next to the name — which used to share the word «статус». `auto` is
 * not a menu item: the tick follows the tab while the status is automatic, and
 * picking an item pins that status until it is changed again. Radix gives the
 * radio group arrows, Enter and Esc, and returns the focus to the trigger.
 */
export const UserStatusMenu = ({
  status,
  onStatusChange,
  onEditProfile,
  onSetStatus,
  signature,
  onAddPhoto,
  onReportBug,
  children,
}: UserStatusMenuProps) => {
  const effective = useEffectiveStatus(status)

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
          <span className="sr-only">
            Статус: «{STATUS_LABEL[effective]}». Открыть меню статуса.
          </span>
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
            <DropdownMenuRadioItem key={option} value={option}>
              <span aria-hidden="true" className={`size-2.5 rounded-full ${STATUS_DOT[option]}`} />
              {STATUS_LABEL[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuGroup>
          <DropdownMenuSeparator />
          {/* The presence above is the status; the emoji and text are its signature. */}
          <DropdownMenuItem onSelect={onSetStatus}>
            <SmileIcon className="size-4 shrink-0 text-fg-muted" />
            <span className="flex min-w-0 flex-col">
              <span>{signature === '' ? 'Задать подпись' : 'Изменить подпись'}</span>
              {signature !== '' && (
                <span className="truncate text-xs text-fg-muted">{signature}</span>
              )}
            </span>
          </DropdownMenuItem>
          {onAddPhoto !== undefined && (
            <DropdownMenuItem onSelect={onAddPhoto}>
              <PlusIcon className="size-4 text-fg-muted" />
              Добавить фото
            </DropdownMenuItem>
          )}
          {onEditProfile !== undefined && (
            <DropdownMenuItem onSelect={onEditProfile}>
              <EditIcon className="size-4 text-fg-muted" />
              Редактировать профиль
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onReportBug}>
          <BugIcon className="size-4 text-fg-muted" />
          Сообщить о проблеме
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
