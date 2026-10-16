// Side effect first: the generated client must have its interceptors before any request.
import './setup'

export { ApiError, CLIENT_ERROR_CODES, isApiError } from './api-error'
export { createQueryClient } from './query-client'

// Generated from api/orbit-server.openapi.yaml (`pnpm api:generate`).
// Query and mutation option factories: useQuery(getReadinessOptions()), useMutation(createVoiceTokenMutation()).
export * from './generated/@tanstack/react-query.gen'
// Plain SDK functions for code outside React Query.
export { createVoiceToken, getLiveness, getReadiness } from './generated/sdk.gen'
export type {
  ErrorDetail,
  Liveness,
  Readiness,
  VoiceToken,
  VoiceTokenRequest,
} from './generated/types.gen'
