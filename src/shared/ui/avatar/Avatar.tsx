import { useState } from 'react'

import { cn } from '@/shared/lib/cn'
import { initials } from '@/shared/lib/initials'

/** The sizes the profile and member lists use, in pixels. */
export type AvatarSize = 20 | 32 | 40 | 80

/** The same values the server sends in `PresenceStatus`. */
export type AvatarStatus = 'online' | 'idle' | 'dnd' | 'offline'

/** One of the named accent tokens of `UserProfile`, never a raw colour. */
export type AvatarAccent =
  'slate' | 'red' | 'amber' | 'green' | 'teal' | 'sky' | 'indigo' | 'violet' | 'pink'

const SIZE_CLASS: Record<AvatarSize, string> = {
  20: 'size-5 text-[0.625rem]',
  32: 'size-8 text-xs',
  40: 'size-10 text-sm',
  80: 'size-20 text-xl',
}

const DOT_SIZE_CLASS: Record<AvatarSize, string> = {
  20: 'size-2',
  32: 'size-2.5',
  40: 'size-2.5',
  80: 'size-3',
}

const STATUS_CLASS: Record<AvatarStatus, string> = {
  online: 'bg-success',
  idle: 'bg-warning',
  dnd: 'bg-danger',
  offline: 'bg-fg-muted',
}

const STATUS_LABEL: Record<AvatarStatus, string> = {
  online: 'В сети',
  idle: 'Отошёл',
  dnd: 'Не беспокоить',
  offline: 'Не в сети',
}

/**
 * Literal class names, one per `--color-profile-*` token, so Tailwind sees
 * them. The API sends a token name; the palette itself belongs to the client.
 */
const ACCENT_CLASS: Record<AvatarAccent, string> = {
  slate: 'bg-profile-slate text-accent-fg',
  red: 'bg-profile-red text-accent-fg',
  amber: 'bg-profile-amber text-accent-fg',
  green: 'bg-profile-green text-accent-fg',
  teal: 'bg-profile-teal text-accent-fg',
  sky: 'bg-profile-sky text-accent-fg',
  indigo: 'bg-profile-indigo text-accent-fg',
  violet: 'bg-profile-violet text-accent-fg',
  pink: 'bg-profile-pink text-accent-fg',
}

const CIRCLE_CLASS =
  'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold select-none'

export interface AvatarProps {
  /** The name the initials are taken from, and the accessible name by default. */
  name: string
  /** The accessible name, when it differs from the initials source, e.g. `@nickname`. */
  label?: string
  /** The picture; the initials stand in while it is absent or fails to load. */
  src?: string | null
  size?: AvatarSize
  /** A dot over the corner; the words go to assistive technology. */
  status?: AvatarStatus
  /** The background of the initials, from the profile's accent token. */
  accent?: AvatarAccent
  /** Hidden from assistive technology when the text next to it already names the person. */
  decorative?: boolean
  /** Classes of the picture itself, such as a speaking ring. */
  className?: string
}

/**
 * One person's picture: the image, or their initials on the profile's accent
 * colour when there is none or the link no longer loads. A broken link is
 * remembered by URL, so a fresh link after the next answer gets its chance.
 */
export const Avatar = ({
  name,
  label,
  src,
  size = 32,
  status,
  accent,
  decorative = false,
  className,
}: AvatarProps) => {
  // The link that failed, not a flag: a new `src` is tried again.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = Boolean(src) && src !== failedUrl
  const accessibleName = label ?? name

  return (
    <span className="relative inline-flex shrink-0">
      {showImage && src ? (
        <img
          src={src}
          alt={decorative ? '' : accessibleName}
          aria-hidden={decorative ? true : undefined}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          draggable={false}
          className={cn(CIRCLE_CLASS, SIZE_CLASS[size], 'object-cover', className)}
          onError={() => {
            setFailedUrl(src)
          }}
        />
      ) : (
        <span
          role={decorative ? undefined : 'img'}
          aria-label={decorative ? undefined : accessibleName}
          aria-hidden={decorative ? true : undefined}
          className={cn(
            CIRCLE_CLASS,
            SIZE_CLASS[size],
            accent ? ACCENT_CLASS[accent] : 'bg-surface-hover text-fg',
            className,
          )}
        >
          {initials(name)}
        </span>
      )}
      {status && (
        <span
          role="img"
          aria-label={STATUS_LABEL[status]}
          title={STATUS_LABEL[status]}
          className={cn(
            'absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-bg',
            DOT_SIZE_CLASS[size],
            STATUS_CLASS[status],
          )}
        />
      )}
    </span>
  )
}
