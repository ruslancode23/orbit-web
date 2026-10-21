import type { UserProfile } from '@/shared/api'

export { FriendActionSlot } from './FriendActionSlot'

/**
 * FR-5 (SCRUM-102) puts «Общие серверы» and «Общие друзья» here. There is no
 * API for the shared lists yet, so the slot draws nothing rather than an empty
 * tab; the dialog only gets tabs once this component returns them.
 */
export const ProfileTabsSlot = (_props: { profile: UserProfile; workspaceId?: string }) => {
  return null
}
