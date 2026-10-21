import { useState } from 'react'

import type { Conversation } from '@/entities/conversation'
import { cn } from '@/shared/lib/cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { EditIcon, LogOutIcon, MoreIcon, PlusIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'

import AddMembersDialog from './AddMembersDialog'
import LeaveGroupDialog from './LeaveGroupDialog'
import RenameGroupDialog from './RenameGroupDialog'

type OpenDialog = 'members' | 'rename' | 'leave' | null

interface GroupActionsProps {
  conversation: Conversation
  className?: string
}

/**
 * What a member may do to a group: add people, rename it or leave it. Each
 * action opens a small dialog, so a failed request stays next to the control
 * that asked for it instead of closing the page.
 */
const GroupActions = ({ conversation, className }: GroupActionsProps) => {
  const [dialog, setDialog] = useState<OpenDialog>(null)
  const close = () => {
    setDialog(null)
  }

  return (
    <div className={cn('flex shrink-0 items-center gap-1', className)}>
      <IconButton
        label="Добавить людей"
        onClick={() => {
          setDialog('members')
        }}
      >
        <PlusIcon />
      </IconButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label="Действия с группой">
            <MoreIcon />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setDialog('rename')
            }}
          >
            <EditIcon className="size-4 text-fg-muted" />
            Переименовать
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-danger"
            onSelect={() => {
              setDialog('leave')
            }}
          >
            <LogOutIcon className="size-4" />
            Выйти из группы
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === 'rename' && (
        <RenameGroupDialog
          conversationId={conversation.id}
          name={conversation.name}
          open
          onOpenChange={(open) => {
            if (!open) {
              close()
            }
          }}
        />
      )}
      {dialog === 'members' && (
        <AddMembersDialog
          conversation={conversation}
          open
          onOpenChange={(open) => {
            if (!open) {
              close()
            }
          }}
        />
      )}
      {dialog === 'leave' && (
        <LeaveGroupDialog
          conversationId={conversation.id}
          open
          onOpenChange={(open) => {
            if (!open) {
              close()
            }
          }}
        />
      )}
    </div>
  )
}

export default GroupActions
