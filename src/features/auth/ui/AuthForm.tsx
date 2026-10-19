import { useId, type ReactNode, type SyntheticEvent } from 'react'

import { Button } from '@/shared/ui/button'

interface AuthFormProps {
  title: string
  submitLabel: string
  busy: boolean
  error: string | null
  onSubmit: () => void
  children: ReactNode
  footer: ReactNode
}

/** The frame both the sign-in and the sign-up forms sit in. */
export function AuthForm({
  title,
  submitLabel,
  busy,
  error,
  onSubmit,
  children,
  footer,
}: AuthFormProps) {
  const titleId = useId()

  function handleSubmit(event: SyntheticEvent) {
    event.preventDefault()
    if (!busy) onSubmit()
  }

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-4"
      aria-labelledby={titleId}
      onSubmit={handleSubmit}
    >
      <h1 id={titleId} className="text-2xl font-semibold">
        {title}
      </h1>

      {children}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy}>
        {busy ? 'Минутку…' : submitLabel}
      </Button>

      <p className="text-sm text-fg-muted">{footer}</p>
    </form>
  )
}
