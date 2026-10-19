import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

import { editMessageMutation, type Message } from '@/shared/api'
import { Button } from '@/shared/ui/button'

import { describeActionError } from '../model/describe-error'
import { replaceMessageInHistory } from '../model/message-cache'

interface EditMessageFormProps {
  message: Message
  /** Closes the editor, whether the text was saved or the author changed their mind. */
  onDone: () => void
}

/**
 * Rewrites the author's own message in place. The server answers with the
 * stored message, and only that message is replaced in the history.
 */
export function EditMessageForm({ message, onDone }: EditMessageFormProps) {
  const [text, setText] = useState(message.content)
  const fieldId = useId()
  const fieldRef = useRef<HTMLTextAreaElement | null>(null)
  const queryClient = useQueryClient()

  const edit = useMutation({
    ...editMessageMutation(),
    onSuccess: (updated) => {
      replaceMessageInHistory(queryClient, message.channelId, updated)
      onDone()
    },
  })

  useEffect(() => {
    const field = fieldRef.current
    if (!field) return
    field.focus()
    field.setSelectionRange(field.value.length, field.value.length)
  }, [])

  const trimmed = text.trim()
  const unchanged = trimmed === message.content.trim()

  function submit() {
    if (!trimmed || edit.isPending) return
    if (unchanged) {
      onDone()
      return
    }
    edit.mutate({ path: { messageId: message.id }, body: { content: trimmed } })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onDone()
      return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label htmlFor={fieldId} className="sr-only">
        Редактировать сообщение
      </label>
      <textarea
        id={fieldId}
        ref={fieldRef}
        value={text}
        rows={2}
        maxLength={4000}
        onChange={(event) => {
          setText(event.target.value)
        }}
        onKeyDown={handleKeyDown}
        className="w-full resize-none rounded-md border border-border bg-surface px-2 py-1 text-sm text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      />
      <div className="flex items-center gap-1">
        <Button type="submit" size="sm" disabled={!trimmed || edit.isPending}>
          Сохранить
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            onDone()
          }}
        >
          Отмена
        </Button>
        {edit.error && (
          <p role="alert" className="text-xs text-danger">
            {describeActionError(edit.error, 'Не получилось изменить сообщение.')}
          </p>
        )}
      </div>
    </form>
  )
}
