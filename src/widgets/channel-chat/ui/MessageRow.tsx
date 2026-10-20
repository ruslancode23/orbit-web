import { AttachmentList } from '@/entities/attachment'
import { authorName, MessageCard, startsNewGroup, type Message } from '@/entities/message'
import { EditMessageForm, MessageActions, ReactionBar } from '@/features/message-actions'
import { UserCard } from '@/features/user-card'

interface MessageRowProps {
  message: Message
  /** The server of the channel; a dialogue has none and so no server role. */
  workspaceId?: string
  /** The message right above it, for grouping. */
  previous?: Message
  mentionsMe: boolean
  myNickname?: string
  canWrite: boolean
  /** The answered message, when it is still in the loaded history. */
  replyTo?: Message
  editing: boolean
  highlighted: boolean
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
  mentionsMe,
  myNickname,
  canWrite,
  replyTo,
  editing,
  highlighted,
  onStartEdit,
  onStopEdit,
  onReply,
  onJumpTo,
}: MessageRowProps) => {
  return (
    <MessageCard
      message={message}
      startsGroup={startsNewGroup(message, previous)}
      mentionsMe={mentionsMe}
      myNickname={myNickname}
      replyTo={replyTo}
      onJumpTo={onJumpTo}
      highlighted={highlighted}
      renderAuthorPart={(part, content) => {
        if (!message.author) {
          return content
        }
        return (
          <UserCard
            userId={message.author.id}
            {...(workspaceId === undefined ? {} : { workspaceId })}
            {...(part === 'avatar' ? { label: authorName(message) } : {})}
            triggerClassName={
              part === 'avatar'
                ? 'inline-flex shrink-0'
                : 'inline-flex text-left text-sm font-semibold leading-5'
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
          onReply={onReply}
          onEdit={onStartEdit}
        />
      }
    >
      <ReactionBar message={message} canWrite={canWrite} />
    </MessageCard>
  )
}
