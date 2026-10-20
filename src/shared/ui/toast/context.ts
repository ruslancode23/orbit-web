import { createContext } from 'react'

export type ToastTone = 'info' | 'success' | 'danger'

export interface ToastValue {
  /** Shows a short message; it disappears on its own and can be dismissed. */
  toast: (message: string, tone?: ToastTone) => void
}

export const ToastContext = createContext<ToastValue | null>(null)
