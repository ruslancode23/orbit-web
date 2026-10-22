import { useNavigate } from 'react-router'

import { describeConversationStartError, useStartConversation } from '@/entities/conversation'
import { useSession } from '@/entities/session'
import type { WorkspaceMember } from '@/entities/workspace'
import { copyText } from '@/shared/lib/clipboard'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu'
import { CopyIcon, MessageIcon } from '@/shared/ui/icon'
import { useToast } from '@/shared/ui/toast'

import type { ReactNode } from 'react'

interface MemberContextMenuProps {
  /** Absent for somebody seen only in voice: then there is no menu. */
  member: WorkspaceMember | undefined
  name: string
  children: ReactNode
}

/**
 * Right click on a member: write to them or copy their handle. The profile
 * itself opens on an ordinary click, so the menu does not repeat it.
 */
export const MemberContextMenu = ({ member, name, children }: MemberContextMenuProps) => {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useSession()
  const start = useStartConversation()

  if (member === undefined) {
    return children
  }

  const isMe = member.user.id === user?.id
  const handle = `@${member.user.nickname}`

  const handleWrite = () => {
    start.mutate(
      { body: { userIds: [member.user.id] } },
      {
        onSuccess: (conversation) => {
          void navigate(`/me/${conversation.id}`)
        },
        onError: (error) => {
          toast(describeConversationStartError(error), 'danger')
        },
      },
    )
  }

  const handleCopy = async () => {
    const done = await copyText(handle)
    toast(done ? 'Ник скопирован' : 'Не удалось скопировать ник.', done ? 'success' : 'danger')
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent aria-label={`Действия с участником ${name}`}>
        <ContextMenuLabel>{name}</ContextMenuLabel>
        {!isMe && (
          <ContextMenuItem disabled={start.isPending} onSelect={handleWrite}>
            <MessageIcon className="size-4 text-fg-muted" />
            Написать сообщение
          </ContextMenuItem>
        )}
        <ContextMenuItem onSelect={() => void handleCopy()}>
          <CopyIcon className="size-4 text-fg-muted" />
          Копировать {handle}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
