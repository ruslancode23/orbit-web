import type { Invite } from '@/shared/api'

const dateFormat = new Intl.DateTimeFormat('ru', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export const formatInviteDate = (date: Date): string => dateFormat.format(date)

export const describeInviteUses = (invite: Invite): string =>
  invite.maxUses === undefined
    ? `Использований: ${String(invite.uses)}`
    : `Использовано ${String(invite.uses)} из ${String(invite.maxUses)}`

export const describeInviteExpiry = (invite: Invite): string =>
  invite.expiresAt === undefined ? 'Бессрочная' : `До ${formatInviteDate(invite.expiresAt)}`
