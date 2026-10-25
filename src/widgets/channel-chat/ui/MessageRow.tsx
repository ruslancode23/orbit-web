import { AttachmentList } from '@/entities/attachment'
import {
  authorName,
  MessageCard,
  startsNewGroup,
  type Message,
  type NamedPerson,
} from '@/entities/message'
import { ClaimGuest } from '@/features/claim-guest'
import {
  EditMessageForm,
  MessageActions,
  MessageContextMenu,
  ReactionBar,
} from '@/features/message-actions'
import { UserCard } from '@/features/user-card'
import { cn } from '@/shared/lib/cn'

import type { ReactNode } from 'react'

interface MessageRowProps {
  message: Message
  /** The server of the channel; a dialogue has none and so no server role. */
  workspaceId?: string
  /** The message right above it, for grouping. */
  previous?: Message
  /** The people of the conversation, to name who a system line added. */
  people?: readonly NamedPerson[]
  mentionsMe: boolean
  myNickname?: string
  canWrite: boolean
  /** manageMessages here: deleting other people's messages. */
  canModerate: boolean
  /** The colour of the author's highest coloured role, as a text class. */
  authorClass?: string | undefined
  /** The answered message, when it is still in the loaded history. */
  replyTo?: Message
  editing: boolean
  highlighted: boolean
  /** The author's button to remove the link preview, when there is one. */
  previewAction?: ReactNode
  onStartEdit: () => void
  onStopEdit: () => void
  onReply: () => void
  onJumpTo: (messageId: string) => void
}

/** One message with its reactions and the actions the reader may take. */
export const MessageRow = ({
  message,
  workspaceId,
  previous,
  people,
  mentionsMe,
  myNickname,
  canWrite,
  canModerate,
  authorClass,
  replyTo,
  editing,
  highlighted,
  previewAction,
  onStartEdit,
  onStopEdit,
  onReply,
  onJumpTo,
}: MessageRowProps) => {
  return (
    <MessageContextMenu
      message={message}
      canWrite={canWrite}
      canModerate={canModerate}
      disabled={editing}
      onReply={onReply}
      onEdit={onStartEdit}
    >
      <MessageCard
        message={message}
        startsGroup={startsNewGroup(message, previous)}
        {...(people === undefined ? {} : { people })}
        mentionsMe={mentionsMe}
        myNickname={myNickname}
        replyTo={replyTo}
        onJumpTo={onJumpTo}
        highlighted={highlighted}
        {...(previewAction === undefined ? {} : { previewAction })}
        renderAuthorPart={(part, content) => {
          if (!message.author) {
            return content
          }
          return (
            <UserCard
              userId={message.author.id}
              {...(workspaceId === undefined ? {} : { workspaceId })}
              guestAction={<ClaimGuest />}
              {...(part === 'avatar' ? { label: authorName(message) } : {})}
              triggerClassName={
                part === 'avatar'
                  ? 'inline-flex shrink-0'
                  : cn('inline-flex text-left text-sm leading-5 font-semibold', authorClass)
              }
            >
              {content}
            </UserCard>
          )
        }}
        editing={editing ? <EditMessageForm message={message} onDone={onStopEdit} /> : undefined}
        attachments={
          message.attachments?.length ? (
            <AttachmentList attachments={message.attachments} />
          ) : undefined
        }
        actions={
          <MessageActions
            message={message}
            canWrite={canWrite}
            canModerate={canModerate}
            onReply={onReply}
            onEdit={onStartEdit}
          />
        }
      >
        <ReactionBar message={message} canWrite={canWrite} />
      </MessageCard>
    </MessageContextMenu>
  )
}
