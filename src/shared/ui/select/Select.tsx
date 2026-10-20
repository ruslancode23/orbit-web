import { Select as Primitive } from 'radix-ui'

import { cn } from '@/shared/lib/cn'
import { ChevronDownIcon } from '@/shared/ui/icon'

import type { ComponentProps } from 'react'

/** A list of choices that opens on a button; arrows move, Enter picks, Esc closes. */
export const Select = Primitive.Root
export const SelectValue = Primitive.Value
export const SelectGroup = Primitive.Group

export const SelectTrigger = ({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Trigger>) => {
  return (
    <Primitive.Trigger
      className={cn(
        'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-sm text-fg transition-colors duration-150 hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
      <Primitive.Icon>
        <ChevronDownIcon className="size-4 text-fg-muted" />
      </Primitive.Icon>
    </Primitive.Trigger>
  )
}

export const SelectContent = ({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Content>) => {
  return (
    <Primitive.Portal>
      <Primitive.Content
        position="popper"
        sideOffset={4}
        className={cn(
          'z-50 max-h-64 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-panel border border-border bg-surface-raised text-fg shadow-popover',
          className,
        )}
        {...props}
      >
        <Primitive.Viewport className="p-1">{children}</Primitive.Viewport>
      </Primitive.Content>
    </Primitive.Portal>
  )
}

export const SelectItem = ({ className, ...props }: ComponentProps<typeof Primitive.Item>) => {
  return (
    <Primitive.Item
      className={cn(
        'flex cursor-pointer items-center rounded-md px-2 py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-hover',
        className,
      )}
      {...props}
    />
  )
}
