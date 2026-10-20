import { useId, useState, type KeyboardEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { formatSize } from '@/entities/attachment'
import { AttachButton } from '@/features/attach-file'
import { env } from '@/shared/config'
import { Button } from '@/shared/ui/button'
import { FileIcon, XIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { Textarea } from '@/shared/ui/textarea'
import { useToast } from '@/shared/ui/toast'

interface ComposerValues {
  text: string
}

interface SecretComposerProps {
  disabled: boolean
  sending: boolean
  onSendText: (text: string) => Promise<boolean>
  onSendFile: (file: File) => Promise<boolean>
}

/**
 * Writes and attaches in one chat. Enter sends, Shift+Enter starts a new line;
 * an empty field with no file does nothing. A changed peer key disables the
 * whole composer, so nothing goes to a key nobody compared.
 */
export const SecretComposer = ({
  disabled,
  sending,
  onSendText,
  onSendFile,
}: SecretComposerProps) => {
  const fieldId = useId()
  const toast = useToast()
  const { control, register, reset } = useForm<ComposerValues>({
    defaultValues: { text: '' },
  })
  const text = useWatch({ control, name: 'text' })
  const [file, setFile] = useState<File | null>(null)
  const { ref: registerText, ...textField } = register('text')
  const busy = disabled || sending
  const canSend = !busy && (text.trim() !== '' || file !== null)

  const chooseFiles = (files: File[]) => {
    const chosen = files[0]
    if (!chosen) {
      return
    }
    if (chosen.size > env.maxUploadBytes) {
      toast(`Файл больше ${formatSize(env.maxUploadBytes)} — такой не отправить.`, 'danger')
      return
    }
    setFile(chosen)
  }

  const submit = async () => {
    const value = text.trim()
    if (busy || (value === '' && file === null)) {
      return
    }
    if (value !== '') {
      const sent = await onSendText(value)
      if (!sent) {
        return
      }
      reset()
    }
    if (file !== null) {
      const sent = await onSendFile(file)
      if (sent) {
        setFile(null)
      }
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
      return
    }
    event.preventDefault()
    void submit()
  }

  return (
    <form
      className="flex shrink-0 flex-col gap-2 border-t border-border p-4"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      {file !== null && (
        <div className="flex items-center gap-2 rounded-md bg-surface px-2 py-1 text-xs text-fg-muted">
          <FileIcon className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <span className="shrink-0">{formatSize(file.size)}</span>
          <IconButton
            label="Убрать файл"
            size="sm"
            onClick={() => {
              setFile(null)
            }}
          >
            <XIcon />
          </IconButton>
        </div>
      )}
      <div className="flex items-end gap-1 rounded-panel border border-border bg-surface py-1.5 pr-1.5 pl-1">
        <AttachButton onFiles={chooseFiles} disabled={busy} />
        <div className="min-w-0 flex-1">
          <label htmlFor={fieldId} className="sr-only">
            Сообщение
          </label>
          <Textarea
            id={fieldId}
            rows={2}
            {...textField}
            ref={registerText}
            placeholder="Написать сообщение"
            disabled={busy}
            className="max-h-40 min-h-10 resize-none border-0 bg-transparent focus-visible:ring-0"
            onKeyDown={handleKeyDown}
          />
        </div>
        <Button type="submit" size="sm" className="shrink-0" disabled={!canSend}>
          {sending ? 'Шифруем…' : 'Отправить'}
        </Button>
      </div>
    </form>
  )
}
