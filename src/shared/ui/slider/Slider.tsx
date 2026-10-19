import { Slider as SliderPrimitive } from 'radix-ui'

import { cn } from '@/shared/lib/cn'

import type { ComponentProps } from 'react'

interface SliderProps extends Omit<ComponentProps<typeof SliderPrimitive.Root>, 'aria-label'> {
  /** Accessible name of the thumb, which is what the keyboard focuses. */
  'aria-label': string
  /** Read out instead of the bare number, e.g. «50 %». */
  getValueText?: (value: number) => string
}

/** A single-thumb slider; arrows, Page Up/Down, Home and End move it. */
export const Slider = ({
  className,
  'aria-label': label,
  getValueText,
  value,
  defaultValue,
  ...props
}: SliderProps) => {
  const current = value?.[0] ?? defaultValue?.[0]
  return (
    <SliderPrimitive.Root
      className={cn('relative flex h-5 w-full touch-none items-center select-none', className)}
      value={value}
      defaultValue={defaultValue}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 grow overflow-hidden rounded-full bg-border">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        aria-valuetext={current !== undefined ? getValueText?.(current) : undefined}
        className="block size-4 rounded-full bg-fg shadow focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none"
      />
    </SliderPrimitive.Root>
  )
}
