import { Popover as Primitive } from 'radix-ui'

import { cn } from '@/shared/lib/cn'

import type { ComponentProps } from 'react'

/** A small panel anchored to a control, e.g. a member card; Esc closes it. */
export const Popover = Primitive.Root
export const PopoverTrigger = Primitive.Trigger
export const PopoverAnchor = Primitive.Anchor

export const PopoverContent = ({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Content>) => {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={6}
        className={cn(
          'z-50 w-64 rounded-panel border border-border bg-surface-raised p-3 text-fg shadow-popover focus-visible:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </Primitive.Content>
    </Primitive.Portal>
  )
}
