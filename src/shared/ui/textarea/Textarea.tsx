import { cn } from '@/shared/lib/cn'

import type { ComponentProps } from 'react'

export const Textarea = ({ className, rows = 3, ...props }: ComponentProps<'textarea'>) => {
  return (
    <textarea
      rows={rows}
      className={cn(
        'w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50 aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  )
}
