import { useQueries } from '@tanstack/react-query'

import { useWorkspaces } from '@/entities/workspace'
import { listWorkspaceMembersOptions, type UserProfile } from '@/shared/api'

interface PeopleToWrite {
  /** Everybody this account shares a server with, once each, by name. */
  people: UserProfile[]
  isPending: boolean
  error: unknown
}

const byName = (a: UserProfile, b: UserProfile): number => {
  return (a.displayName || a.nickname).localeCompare(b.displayName || b.nickname, 'ru')
}

/**
 * The people one may start a dialogue with: everybody on the servers this
 * account is in. There is no "all users" endpoint, and a stranger is not
 * someone the product wants to offer for a personal message anyway.
 */
export const usePeopleToWrite = (): PeopleToWrite => {
  const workspaces = useWorkspaces()
  const ids = workspaces.data?.map((membership) => membership.workspace.id) ?? []
  const members = useQueries({
    queries: ids.map((workspaceId) => ({
      ...listWorkspaceMembersOptions({ path: { workspaceId } }),
      staleTime: 5 * 60 * 1000,
    })),
    combine: (results) => {
      const everyone = new Map<string, UserProfile>()
      for (const result of results) {
        for (const member of result.data ?? []) {
          everyone.set(member.user.id, member.user)
        }
      }
      return {
        people: [...everyone.values()].sort(byName),
        pending: results.some((result) => result.isPending),
        failed: results.some((result) => result.error !== null),
      }
    },
  })

  return {
    people: members.people,
    isPending: workspaces.isPending || members.pending,
    error: workspaces.error ?? (members.failed ? new Error('members') : null),
  }
}
