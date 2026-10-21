import { createContext } from 'react'

export type ToastTone = 'info' | 'success' | 'danger'

/** One thing the reader may do about the message, such as return what was hidden. */
export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastValue {
  /** Shows a short message; it disappears on its own and can be dismissed. */
  toast: (message: string, tone?: ToastTone, action?: ToastAction) => void
}

export const ToastContext = createContext<ToastValue | null>(null)
