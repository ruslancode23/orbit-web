import type { UserProfile } from '@/shared/api'

/**
 * A status with a deadline stops showing when that deadline passes, even if
 * the server has not sent a fresh profile yet. The server hides expired statuses
 * too; this check keeps a cached card honest while it waits.
 */
export const visibleCustomStatus = (
  profile: Pick<UserProfile, 'customStatus'> | undefined,
  now: Date = new Date(),
): string => {
  const status = profile?.customStatus
  if (!status) {
    return ''
  }
  if (status.expiresAt !== undefined && status.expiresAt.getTime() <= now.getTime()) {
    return ''
  }
  return [status.emoji, status.text]
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .join(' ')
}

/** Whether a status still has a deadline ahead of it, for the editor. */
export const statusIsAlive = (status: UserProfile['customStatus'], now = new Date()): boolean => {
  return status?.expiresAt === undefined || status.expiresAt.getTime() > now.getTime()
}

const REGISTERED = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** The day an account appeared: «18 октября 2026 г.». */
export const formatRegistrationDate = (date: Date): string => {
  return REGISTERED.format(date)
}

const BANNER_CLASS: Record<UserProfile['accentColor'], string> = {
  slate: 'bg-profile-slate',
  red: 'bg-profile-red',
  amber: 'bg-profile-amber',
  green: 'bg-profile-green',
  teal: 'bg-profile-teal',
  sky: 'bg-profile-sky',
  indigo: 'bg-profile-indigo',
  violet: 'bg-profile-violet',
  pink: 'bg-profile-pink',
}

/**
 * The banner behind the avatar wears the profile's accent. It never carries
 * text: the palette is tuned for the avatar initials, so a line printed on it
 * could fail contrast in either direction.
 */
export const accentBannerClass = (accent: UserProfile['accentColor'] | undefined): string => {
  return accent ? BANNER_CLASS[accent] : 'bg-surface-hover'
}
