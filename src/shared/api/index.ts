// Side effect first: the generated client must have its interceptors before any request.
import './setup'

export { ApiError, CLIENT_ERROR_CODES, isApiError } from './api-error'
export { createQueryClient } from './query-client'
export {
  uploadAttachmentWithProgress,
  type UploadAttachmentVariables,
  type UploadProgress,
} from './upload'

// Generated from api/orbit-server.openapi.yaml (`pnpm api:generate`).
// Query and mutation option factories: useQuery(getReadinessOptions()), useMutation(createVoiceTokenMutation()).
export * from './generated/@tanstack/react-query.gen'
// Plain SDK functions for code outside React Query.
export {
  acknowledgeSecretEnvelope,
  countOneTimeKeys,
  getConversation,
  listConversations,
  startConversation,
  createChannelVoiceToken,
  getAttachmentLink,
  getKeyBundle,
  getLiveness,
  leaveSecretChat,
  getReadiness,
  listDevices,
  listSecretChats,
  listSecretEnvelopes,
  listUserDevices,
  registerDevice,
  revokeDevice,
  sendSecretEnvelope,
  startSecretChat,
  uploadOneTimeKeys,
} from './generated/sdk.gen'
export type {
  Attachment,
  AttachmentLink,
  Device,
  DeviceRegistration,
  KeyBundle,
  OneTimeKey,
  SecretChat,
  SecretChatPeer,
  SecretChatStartRequest,
  SecretEnvelope,
  SecretEnvelopeCreate,
  Channel,
  ChannelUnread,
  Conversation,
  ConversationMember,
  ConversationStartRequest,
  ChannelUpdateRequest,
  ErrorDetail,
  GuestJoin,
  GuestJoinRequest,
  Invite,
  InviteCreateRequest,
  InvitePreview,
  Liveness,
  LoginRequest,
  Message,
  MessagePage,
  Readiness,
  RegisterRequest,
  User,
  VoiceParticipant,
  VoicePresence,
  VoiceToken,
  Workspace,
  WorkspaceMember,
  WorkspaceMembership,
  WorkspacePermissions,
  WorkspaceRole,
  WorkspaceUpdateRequest,
} from './generated/types.gen'
