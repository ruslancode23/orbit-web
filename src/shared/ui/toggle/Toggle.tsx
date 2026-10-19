import { cva, type VariantProps } from 'class-variance-authority'
import { Toggle as TogglePrimitive } from 'radix-ui'

import { cn } from '@/shared/lib/cn'

import type { ComponentProps } from 'react'

const toggleVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface text-sm font-medium text-fg transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=on]:border-danger data-[state=on]:text-danger',
  {
    variants: {
      size: {
        md: 'h-10 px-4',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

export interface ToggleProps
  extends ComponentProps<typeof TogglePrimitive.Root>, VariantProps<typeof toggleVariants> {}

/** A two-state button (`aria-pressed`); pressed means the thing is switched off, e.g. a muted microphone. */
export const Toggle = ({ className, size, ...props }: ToggleProps) => {
  return <TogglePrimitive.Root className={cn(toggleVariants({ size }), className)} {...props} />
}
