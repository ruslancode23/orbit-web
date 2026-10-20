import { use } from 'react'

import { ToastContext, type ToastValue } from './context'

/** Shows a toast; must be called under the `ToastProvider` the app mounts at the root. */
export const useToast = (): ToastValue['toast'] => {
  const value = use(ToastContext)
  if (!value) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }
  return value.toast
}
