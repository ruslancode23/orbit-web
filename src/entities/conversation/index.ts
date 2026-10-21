export { describeConversationError } from './model/errors'
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
  useUnhideConversation,
  type ConversationSummary,
} from './model/queries'
export type { Conversation, ConversationMember, ConversationStartRequest } from '@/shared/api'
