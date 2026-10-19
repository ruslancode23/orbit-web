import { Tooltip as TooltipPrimitive } from 'radix-ui'

import { cn } from '@/shared/lib/cn'

import type { ComponentProps, ReactElement, ReactNode } from 'react'

interface TooltipProps {
  /** What the hint says. */
  content: ReactNode
  /**
   * The control it explains: a focusable element, since the hint shows on
   * keyboard focus as well as on hover. It keeps its own accessible name.
   */
  children: ReactElement
  side?: ComponentProps<typeof TooltipPrimitive.Content>['side']
  className?: string
}

/** A short hint next to a control, on hover and on focus; Esc hides it. */
export const Tooltip = ({ content, children, side = 'top', className }: TooltipProps) => {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={8}
            className={cn(
              'z-50 max-w-64 rounded-md border border-border bg-bg px-2 py-1 text-sm font-medium text-fg shadow-lg',
              className,
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
