import { Tabs as Primitive } from 'radix-ui'

import { cn } from '@/shared/lib/cn'

import type { ComponentProps } from 'react'

/** Tabs switch a dialog's sections; arrows move between them, focus follows. */
export const Tabs = Primitive.Root
export const TabsContent = Primitive.Content

export const TabsList = ({ className, ...props }: ComponentProps<typeof Primitive.List>) => {
  return (
    <Primitive.List
      className={cn('flex shrink-0 gap-1 rounded-md bg-bg p-1 text-fg-muted', className)}
      {...props}
    />
  )
}

export const TabsTrigger = ({ className, ...props }: ComponentProps<typeof Primitive.Trigger>) => {
  return (
    <Primitive.Trigger
      className={cn(
        'flex-1 rounded px-2 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none data-[state=active]:bg-surface-hover data-[state=active]:text-fg',
        className,
      )}
      {...props}
    />
  )
}
