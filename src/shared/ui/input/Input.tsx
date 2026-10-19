import { cn } from '@/shared/lib/cn'

import type { ComponentProps } from 'react'

export const Input = ({ className, type = 'text', ...props }: ComponentProps<'input'>) => {
  return (
    <input
      type={type}
      className={cn(
        'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50 aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  )
}
