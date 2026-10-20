import { cn } from '@/shared/lib/cn'

/** The Orbit mark: a planet with its ring. Decorative — the name sits next to it. */
export const Logo = ({ className }: { className?: string }) => {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      className={cn('text-accent', className)}
    >
      <circle cx="24" cy="24" r="7" fill="currentColor" />
      <ellipse
        cx="24"
        cy="24"
        rx="20"
        ry="8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        transform="rotate(-28 24 24)"
      />
      <circle cx="39" cy="12" r="2.5" fill="currentColor" />
    </svg>
  )
}
