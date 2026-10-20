import { cn } from '@/shared/lib/cn'

/** A placeholder shape while the real content arrives. Always hidden from assistive tech. */
export const Skeleton = ({ className }: { className?: string }) => {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block animate-pulse rounded-md bg-surface-hover motion-reduce:animate-none',
        className,
      )}
    />
  )
}
