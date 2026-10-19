import { Switch as SwitchPrimitive } from 'radix-ui'

import { cn } from '@/shared/lib/cn'

import type { ComponentProps } from 'react'

/** An on/off switch (`role="switch"`); Space toggles it. Name it with a `Label` or `aria-label`. */
export const Switch = ({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) => {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border bg-surface-hover p-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none disabled:opacity-50 data-[state=checked]:border-accent data-[state=checked]:bg-accent',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4.5 rounded-full bg-fg shadow transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-accent-fg" />
    </SwitchPrimitive.Root>
  )
}
