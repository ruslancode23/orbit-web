import { useRef, type ChangeEvent } from 'react'

import { Button } from '@/shared/ui/button'

interface AttachButtonProps {
  onFiles: (files: File[]) => void
  disabled?: boolean
}

/** Opens the system file picker; several files may be chosen at once. */
export const AttachButton = ({ onFiles, disabled = false }: AttachButtonProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])]
    // Picking the same file again must fire a change again.
    event.target.value = ''
    if (files.length > 0) {
      onFiles(files)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleChange}
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label="Прикрепить файл"
        title="Прикрепить файл"
        disabled={disabled}
        onClick={() => {
          inputRef.current?.click()
        }}
      >
        <span aria-hidden="true">📎</span>
      </Button>
    </>
  )
}
