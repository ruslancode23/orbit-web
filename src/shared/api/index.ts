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
export { createChannelVoiceToken, getLiveness, getReadiness } from './generated/sdk.gen'
export type {
  Attachment,
  AttachmentLink,
  Channel,
  ChannelUnread,
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
