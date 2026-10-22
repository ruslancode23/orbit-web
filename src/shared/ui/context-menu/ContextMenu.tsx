import { ContextMenu as Primitive } from 'radix-ui'

import { cn } from '@/shared/lib/cn'

import type { ComponentProps } from 'react'

/**
 * A menu of actions opened by a right click or a long press on its trigger.
 * Arrows move, Esc and a click outside close it, and it flips to stay on screen.
 * Every action in it must also be reachable without it: a context menu is a
 * shortcut, keyboard and screen-reader users rarely find it.
 */
export const ContextMenu = Primitive.Root
export const ContextMenuTrigger = Primitive.Trigger
export const ContextMenuGroup = Primitive.Group
export const ContextMenuSub = Primitive.Sub

const contentClass =
  'z-50 min-w-52 overflow-hidden rounded-panel border border-border bg-surface-raised p-1 text-fg shadow-popover'

const itemClass =
  'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-hover'

export const ContextMenuContent = ({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Content>) => {
  return (
    <Primitive.Portal>
      <Primitive.Content collisionPadding={8} className={cn(contentClass, className)} {...props}>
        {children}
      </Primitive.Content>
    </Primitive.Portal>
  )
}

interface ContextMenuItemProps extends ComponentProps<typeof Primitive.Item> {
  /** A destructive action: deleting, leaving. */
  danger?: boolean
}

export const ContextMenuItem = ({ className, danger = false, ...props }: ContextMenuItemProps) => {
  return (
    <Primitive.Item
      className={cn(itemClass, danger && 'text-danger data-[highlighted]:bg-danger/10', className)}
      {...props}
    />
  )
}

export const ContextMenuSeparator = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.Separator>) => {
  return <Primitive.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
}

export const ContextMenuLabel = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.Label>) => {
  return (
    <Primitive.Label
      className={cn('truncate px-2 py-1.5 text-xs font-semibold text-fg-muted', className)}
      {...props}
    />
  )
}

/** The item that opens a nested menu; the arrow says there is more. */
export const ContextMenuSubTrigger = ({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.SubTrigger>) => {
  return (
    <Primitive.SubTrigger
      className={cn(itemClass, 'data-[state=open]:bg-surface-hover', className)}
      {...props}
    >
      {children}
      <span aria-hidden="true" className="ml-auto text-fg-muted">
        ›
      </span>
    </Primitive.SubTrigger>
  )
}

export const ContextMenuSubContent = ({
  className,
  ...props
}: ComponentProps<typeof Primitive.SubContent>) => {
  return (
    <Primitive.Portal>
      <Primitive.SubContent
        sideOffset={4}
        collisionPadding={8}
        className={cn(contentClass, 'min-w-0', className)}
        {...props}
      />
    </Primitive.Portal>
  )
}
