import { useEffect, useRef, useState } from 'react'

import { copyText } from '@/shared/lib/clipboard'
import { CopyIcon } from '@/shared/ui/icon'
import { useToast } from '@/shared/ui/toast'

const COPIED_MS = 1500

/** The handle as people type it, with a button that copies it. */
export const CopyNicknameButton = ({ nickname }: { nickname: string }) => {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current)
    }
  }, [])

  const handleCopy = async () => {
    const value = `@${nickname}`
    const done = await copyText(value)
    if (!done) {
      toast('Не удалось скопировать ник.', 'danger')
      return
    }
    setCopied(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setCopied(false)
    }, COPIED_MS)
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-label={`Скопировать @${nickname}`}
        title={`Скопировать @${nickname}`}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        onClick={() => void handleCopy()}
      >
        <CopyIcon className="size-3.5" />
      </button>
      <span role="status" aria-live="polite" className="text-xs text-success">
        {copied ? 'Скопировано' : ''}
      </span>
    </span>
  )
}
