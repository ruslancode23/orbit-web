import { useId, type ReactNode, type SyntheticEvent } from 'react'

import { Button } from '@/shared/ui/button'

interface AuthFormProps {
  title: string
  submitLabel: string
  busy: boolean
  error: string | null
  /** The handler `handleSubmit` from react-hook-form builds: it validates, then sends. */
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>
  children: ReactNode
  footer: ReactNode
}

/** The frame both the sign-in and the sign-up forms sit in. */
export const AuthForm = ({
  title,
  submitLabel,
  busy,
  error,
  onSubmit,
  children,
  footer,
}: AuthFormProps) => {
  const titleId = useId()

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-4"
      aria-labelledby={titleId}
      onSubmit={(event) => {
        // A second Enter while the first request is out must not send it again.
        if (busy) {
          event.preventDefault()
          return
        }
        void onSubmit(event)
      }}
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
