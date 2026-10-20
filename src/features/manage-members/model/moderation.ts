/**
 * The moderation model lives in the workspace entity: the member list, the
 * members dialog and the user card all need the same rules and calls.
 */
export {
  describeMemberActionError,
  mayChangeRole,
  mayModerate,
  ROLE_NAME,
  useMemberModeration,
} from '@/entities/workspace'
