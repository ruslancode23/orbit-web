import type { UserProfile } from '@/shared/api'

/**
 * FR-4 (SCRUM-101) puts «Добавить в друзья» here. The card already renders the
 * slot next to its own actions, so that task replaces this one component and
 * changes no call site.
 */
export const FriendActionSlot = (_props: { userId: string }) => {
  return null
}

/**
 * FR-5 (SCRUM-102) puts «Общие серверы» and «Общие друзья» here. There is no
 * API for the shared lists yet, so the slot draws nothing rather than an empty
 * tab; the dialog only gets tabs once this component returns them.
 */
export const ProfileTabsSlot = (_props: { profile: UserProfile; workspaceId?: string }) => {
  return null
}
