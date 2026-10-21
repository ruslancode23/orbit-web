import { Toast as Primitive } from 'radix-ui'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/shared/lib/cn'
import { XIcon } from '@/shared/ui/icon'

import { ToastContext, type ToastAction, type ToastTone, type ToastValue } from './context'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  action?: ToastAction
}

/**
 * Short messages about things that just happened ("Устройство отключилось",
 * "Ссылка скопирована"). Radix announces them as a status region, so a screen
 * reader hears them without the focus moving.
 */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback((message: string, tone: ToastTone = 'info', action?: ToastAction) => {
    const id = Date.now() + Math.random()
    setItems((current) => [...current, { id, message, tone, ...(action ? { action } : {}) }])
  }, [])

  const value = useMemo<ToastValue>(() => ({ toast }), [toast])

  return (
    <ToastContext value={value}>
      {children}
      {createPortal(
        <Primitive.Provider swipeDirection="right">
          <Primitive.Viewport className="fixed right-4 bottom-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
            {items.map((item) => (
              <Primitive.Root
                key={item.id}
                role="status"
                defaultOpen
                duration={5000}
                onOpenChange={(open) => {
                  if (!open) {
                    dismiss(item.id)
                  }
                }}
                className={cn(
                  'flex items-center gap-3 rounded-panel border border-border bg-surface-raised px-4 py-3 text-sm shadow-popover',
                  item.tone === 'danger' && 'border-danger/60 text-danger',
                  item.tone === 'success' && 'border-success/60',
                )}
              >
                <Primitive.Description className="min-w-0 flex-1">
                  {item.message}
                </Primitive.Description>
                {item.action && (
                  <button
                    type="button"
                    className="shrink-0 rounded text-sm font-medium text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                    onClick={() => {
                      item.action?.onClick()
                      dismiss(item.id)
                    }}
                  >
                    {item.action.label}
                  </button>
                )}
                <Primitive.Close asChild>
                  <button
                    type="button"
                    aria-label="Закрыть уведомление"
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded text-fg-muted hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </Primitive.Close>
              </Primitive.Root>
            ))}
          </Primitive.Viewport>
        </Primitive.Provider>,
        document.body,
      )}
    </ToastContext>
  )
}
