import { Label as LabelPrimitive } from 'radix-ui'

import { cn } from '@/shared/lib/cn'

import type { ComponentProps } from 'react'

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn('text-sm font-medium text-fg', className)} {...props} />
}
