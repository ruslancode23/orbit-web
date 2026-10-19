import { cva } from 'class-variance-authority'
import { useState, type ReactNode } from 'react'

import { cn } from '@/shared/lib/cn'

import { avatarColorIndex, initials } from '../lib/avatar'

/** Literal class names, one per `--color-avatar-N` token, so Tailwind sees them. */
const BACKGROUNDS = [
  'bg-avatar-1',
  'bg-avatar-2',
  'bg-avatar-3',
  'bg-avatar-4',
  'bg-avatar-5',
  'bg-avatar-6',
] as const

const pictureVariants = cva(
  'flex shrink-0 items-center justify-center overflow-hidden font-semibold text-accent-fg transition-[border-radius] select-none',
  {
    variants: {
      size: {
        sm: 'size-6 rounded-md text-[0.625rem]',
        md: 'size-10 rounded-2xl text-sm',
        lg: 'size-16 rounded-2xl text-xl',
        xl: 'size-24 rounded-3xl text-3xl',
      },
      active: { true: 'rounded-xl ring-2 ring-accent', false: '' },
    },
    defaultVariants: { size: 'md', active: false },
  },
)

export interface WorkspaceAvatarProps {
  name: string
  /** A signed, short-lived link: pass the one from the latest answer, never a stored one. */
  iconUrl?: string | null
  /** Picks the background of the initials; the server id, so a rename keeps it. */
  colorKey?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** The server on screen: a tall bar on the left and a ring. */
  active?: boolean
  /** Something unread there: a short bar on the left. */
  unread?: boolean
  /** A mark over the corner, such as the mention count. */
  badge?: ReactNode
  /**
   * Hidden from assistive technology when the control around it already says
   * the name (a link in the rail); otherwise it is an image named after the server.
   */
  decorative?: boolean
  className?: string
}

/**
 * A server's picture: its icon, or its initials on a colour from the theme when
 * there is none or the link no longer loads. The state marks are pictures only;
 * the control around the avatar says the same in its accessible name.
 */
export const WorkspaceAvatar = ({
  name,
  iconUrl,
  colorKey,
  size = 'md',
  active = false,
  unread = false,
  badge,
  decorative = false,
  className,
}: WorkspaceAvatarProps) => {
  // The link that failed, not a flag: a fresh link after a refetch gets its chance.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showIcon = Boolean(iconUrl) && iconUrl !== failedUrl
  const indicator = active ? 'active' : unread ? 'unread' : undefined

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {indicator && (
        <span
          aria-hidden="true"
          data-indicator={indicator}
          className={cn(
            'absolute top-1/2 -left-2 w-1 -translate-y-1/2 rounded-r-full bg-fg transition-[height]',
            indicator === 'active' ? 'h-8' : 'h-2',
          )}
        />
      )}
      <span
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : name}
        aria-hidden={decorative ? true : undefined}
        className={cn(
          pictureVariants({ size, active }),
          !showIcon && BACKGROUNDS[avatarColorIndex(colorKey ?? name)],
        )}
      >
        {showIcon && iconUrl ? (
          <img
            src={iconUrl}
            alt=""
            draggable={false}
            className="size-full object-cover"
            onError={() => {
              setFailedUrl(iconUrl)
            }}
          />
        ) : (
          initials(name)
        )}
      </span>
      {badge && <span className="absolute -top-1 -right-1">{badge}</span>}
    </span>
  )
}
