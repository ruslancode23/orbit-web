import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState, type KeyboardEvent } from 'react'

import { isApiError, listMessagesInfiniteQueryKey, sendMessageMutation } from '@/shared/api'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

interface SendMessageProps {
  channelId: string
}

interface Attempt {
  clientMessageId: string
  content: string
}

/**
 * Writes a message. The send carries the client's own id, so repeating it after
 * a failure gives the same message instead of a second copy — the retry button
 * reuses that id on purpose. Offline TanStack Query holds the send until the
 * network is back and then sends it once, with that same id.
 */
export function SendMessage({ channelId }: SendMessageProps) {
  const inputId = useId()
  const [text, setText] = useState('')
  const [failed, setFailed] = useState<Attempt | null>(null)
  const queryClient = useQueryClient()

  const send = useMutation({
    ...sendMessageMutation(),
    onSuccess: async () => {
      setFailed(null)
      // The history is the source of truth; ask it again for what we just added.
      await queryClient.invalidateQueries({
        queryKey: listMessagesInfiniteQueryKey({ path: { channelId } }),
      })
    },
  })

  function submit(attempt: Attempt) {
    setFailed(null)
    send.mutate(
      { path: { channelId }, body: attempt },
      {
        onError: () => {
          // Keep the id: the retry must not create a second message.
          setFailed(attempt)
        },
      },
    )
  }

  function handleSubmit() {
    const content = text.trim()
    if (!content || send.isPending) return
    setText('')
    submit({ clientMessageId: crypto.randomUUID(), content })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border p-4">
      {send.isPaused && (
        <p role="status" className="text-sm text-fg-muted">
          Нет сети — отправим, как только соединение вернётся.
        </p>
      )}
      {failed && (
        <p role="alert" className="flex items-center gap-2 text-sm text-danger">
          {describeError(send.error)}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              submit(failed)
            }}
          >
            Повторить
          </Button>
        </p>
      )}
      <div className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          Сообщение
        </label>
        <Input
          id={inputId}
          value={text}
          placeholder="Напишите сообщение"
          maxLength={4000}
          onChange={(event) => {
            setText(event.target.value)
          }}
          onKeyDown={handleKeyDown}
        />
        <Button disabled={send.isPending || !text.trim()} onClick={handleSubmit}>
          Отправить
        </Button>
      </div>
    </div>
  )
}

function describeError(error: unknown): string {
  if (!isApiError(error)) return 'Сообщение не отправилось.'
  if (error.isNetworkError) return 'Нет соединения с сервером.'
  if (error.status === 403) return 'В этом канале вы не можете писать.'
  return 'Сообщение не отправилось.'
}
