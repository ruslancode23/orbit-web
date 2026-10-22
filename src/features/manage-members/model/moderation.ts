/**
 * The moderation model lives in the workspace entity: the member list, the
 * members dialog and the user card all need the same rules and calls.
 */
export {
  describeMemberActionError,
  mayBan,
  mayChangeRole,
  mayKick,
  ROLE_NAME,
  useMemberModeration,
  type Standing,
} from '@/entities/workspace'
