import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib/cn'
import { Tooltip } from '@/shared/ui/tooltip'

import type { ComponentProps, ReactNode } from 'react'

const iconButtonVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        ghost:
          'text-fg-muted hover:bg-surface-hover hover:text-fg aria-pressed:bg-surface-hover aria-pressed:text-fg',
        subtle: 'bg-surface text-fg-muted hover:bg-surface-hover hover:text-fg',
        danger: 'text-danger hover:bg-danger/15 hover:text-danger',
      },
      size: {
        sm: 'size-7',
        md: 'size-8',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
    },
  },
)

export interface IconButtonProps
  extends Omit<ComponentProps<'button'>, 'aria-label'>, VariantProps<typeof iconButtonVariants> {
  /** The accessible name; it becomes `aria-label` and, by default, the hint. */
  label: string
  /** What the hint says, when it should differ from the name. */
  tooltip?: ReactNode
  /** For a two-state control: the same name stays, the state changes. */
  pressed?: boolean
  side?: ComponentProps<typeof Tooltip>['side']
}

/**
 * A square button that is a picture: an icon, a required accessible name and a
 * hint on hover and focus. Text buttons stay for actions where a word is the
 * clearer control.
 */
export const IconButton = ({
  label,
  tooltip,
  pressed,
  side,
  variant,
  size,
  type = 'button',
  className,
  ...props
}: IconButtonProps) => {
  return (
    <Tooltip content={tooltip ?? label} {...(side === undefined ? {} : { side })}>
      <button
        type={type}
        aria-label={label}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
        {...props}
      />
    </Tooltip>
  )
}
