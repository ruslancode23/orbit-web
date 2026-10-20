import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  banWorkspaceMemberMutation,
  isApiError,
  listWorkspaceMembersQueryKey,
  removeWorkspaceMemberMutation,
  setWorkspaceMemberRoleMutation,
  type WorkspaceMember,
  type WorkspaceRole,
} from '@/shared/api'

import { atLeast } from './workspace'

export const ROLE_NAME: Record<WorkspaceRole, string> = {
  owner: 'владелец',
  admin: 'админ',
  member: 'участник',
}

/**
 * Changing a role, removing and banning — the calls a moderator can make. Both
 * the member list and the member card use them, so the rules live in one place.
 */
export const useMemberModeration = (workspaceId: string) => {
  const queryClient = useQueryClient()

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: listWorkspaceMembersQueryKey({ path: { workspaceId } }),
    })
  }

  const setRole = useMutation({ ...setWorkspaceMemberRoleMutation(), onSuccess: refresh })
  const remove = useMutation({ ...removeWorkspaceMemberMutation(), onSuccess: refresh })
  const ban = useMutation({ ...banWorkspaceMemberMutation(), onSuccess: refresh })

  return {
    setRole,
    remove,
    ban,
    pending: setRole.isPending || remove.isPending || ban.isPending,
    error: setRole.error ?? remove.error ?? ban.error,
  }
}

/** Moderation goes downwards only, and never against oneself — as on the server. */
export const mayModerate = (
  myRole: WorkspaceRole | undefined,
  member: WorkspaceMember,
  myId: string | undefined,
): boolean => {
  if (myRole === undefined) {
    return false
  }
  return member.user.id !== myId && atLeast(myRole, 'admin') && !atLeast(member.role, myRole)
}

/** Only the owner moves people between roles. */
export const mayChangeRole = (
  myRole: WorkspaceRole | undefined,
  member: WorkspaceMember,
  myId: string | undefined,
): boolean => {
  return myRole === 'owner' && member.user.id !== myId
}

export const describeMemberActionError = (error: unknown): string => {
  if (!isApiError(error)) {
    return 'Не получилось изменить участника.'
  }
  if (error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  if (error.status === 403) {
    return 'Для этого не хватает прав.'
  }
  if (error.status === 400) {
    return 'Сервер всегда должен остаться с владельцем.'
  }
  return 'Не получилось изменить участника.'
}
