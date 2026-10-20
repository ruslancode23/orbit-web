import { DropdownMenu as Primitive } from 'radix-ui'

import { cn } from '@/shared/lib/cn'
import { CheckIcon } from '@/shared/ui/icon'

import type { ComponentProps } from 'react'

/** A menu of actions opened from a button; arrows move, Esc closes, focus returns. */
export const DropdownMenu = Primitive.Root
export const DropdownMenuTrigger = Primitive.Trigger
export const DropdownMenuGroup = Primitive.Group
export const DropdownMenuRadioGroup = Primitive.RadioGroup

export const DropdownMenuContent = ({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Content>) => {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={6}
        className={cn(
          'z-50 min-w-52 overflow-hidden rounded-panel border border-border bg-surface-raised p-1 text-fg shadow-popover',
          className,
        )}
        {...props}
      >
        {children}
      </Primitive.Content>
    </Primitive.Portal>
  )
}

export const DropdownMenuItem = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.Item>) => {
  return (
    <Primitive.Item
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-hover',
        className,
      )}
      {...props}
    />
  )
}

export const DropdownMenuSeparator = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.Separator>) => {
  return <Primitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
}

export const DropdownMenuLabel = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.Label>) => {
  return (
    <Primitive.Label
      className={cn('px-2 py-1.5 text-xs font-semibold text-fg-muted', className)}
      {...props}
    />
  )
}

/** One choice in a `DropdownMenuRadioGroup`; a check mark shows the current one. */
export const DropdownMenuRadioItem = ({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.RadioItem>) => {
  return (
    <Primitive.RadioItem
      className={cn(
        'relative flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 pl-7 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-hover',
        className,
      )}
      {...props}
    >
      <Primitive.ItemIndicator className="absolute left-2 flex items-center">
        <CheckIcon className="size-3.5" />
      </Primitive.ItemIndicator>
      {children}
    </Primitive.RadioItem>
  )
}
