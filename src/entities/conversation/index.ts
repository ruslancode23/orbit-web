export {
  describeConversationError,
  describeConversationStartError,
  isTooManyMembers,
} from './model/errors'
export {
  conversationMembersExcept,
  conversationName,
  conversationPeer,
  useAddConversationMembers,
  useConversation,
  useConversationSummaries,
  useHideConversation,
  useLeaveConversation,
  useRenameConversation,
  useStartConversation,
  useStartGroupConversation,
  useUnhideConversation,
  type ConversationSummary,
  type StartedGroup,
  type StartGroupVariables,
} from './model/queries'
export type { Conversation, ConversationMember, ConversationStartRequest } from '@/shared/api'
