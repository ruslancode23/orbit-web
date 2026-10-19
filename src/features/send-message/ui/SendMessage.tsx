import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { authorName, mentionedIds, messagePreview, type Message } from '@/entities/message'
import { useSession } from '@/entities/session'
import { useWorkspaceMembers } from '@/entities/workspace'
import {
  isApiError,
  listMessagesInfiniteQueryKey,
  sendMessageMutation,
  type User,
} from '@/shared/api'
import { Button } from '@/shared/ui/button'

interface SendMessageProps {
  workspaceId: string
  channelId: string
  /** The message the new one answers, if the reader chose one. */
  replyTo?: Message
  onCancelReply?: () => void
  /** Called after the server stored the message, so the reply can be cleared. */
  onSent?: () => void
  /** Files already uploaded for this message; it may then go without text. */
  attachmentIds?: readonly string[]
  /** True while a file is still uploading: the message waits for it. */
  attachmentsBusy?: boolean
  /** The files on their way, shown above the field. */
  attachments?: ReactNode
  /** A control beside the field, such as the file picker. */
  attachControl?: ReactNode
  /** Files pasted into the field, such as a screenshot. */
  onPasteFiles?: (files: File[]) => void
  /** The message was handed to the send with the files above; they can be cleared. */
  onSending?: () => void
}

interface ComposerValues {
  content: string
}

interface Attempt {
  clientMessageId: string
  content: string
  replyToId?: string
  attachmentIds: readonly string[]
}

/** The `@word` being typed right before the caret, if any. */
interface MentionQuery {
  /** Where the `@` is. */
  start: number
  query: string
}

/** At most this many hints at once: a list longer than that is not a hint. */
const MAX_SUGGESTIONS = 8

/**
 * Writes a message. The send carries the client's own id, so repeating it after
 * a failure gives the same message instead of a second copy — the retry button
 * reuses that id on purpose. Offline TanStack Query holds the send until the
 * network is back and then sends it once, with that same id.
 *
 * Typing `@` opens the members of the server; the chosen nickname goes into the
 * text and the send names the accounts explicitly, because the server does not
 * parse mentions out of the text itself.
 */
export const SendMessage = ({
  workspaceId,
  channelId,
  replyTo,
  onCancelReply,
  onSent,
  attachmentIds = [],
  attachmentsBusy = false,
  attachments,
  attachControl,
  onPasteFiles,
  onSending,
}: SendMessageProps) => {
  const fieldId = useId()
  const listId = useId()
  const hintId = useId()
  const fieldRef = useRef<HTMLTextAreaElement | null>(null)
  const caretRef = useRef<number | null>(null)
  const { register, control, setValue, reset } = useForm<ComposerValues>({
    defaultValues: { content: '' },
  })
  const text = useWatch({ control, name: 'content' })
  // Where the caret and the hint list are is not form data: it stays local.
  const [caret, setCaret] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [failed, setFailed] = useState<Attempt | null>(null)
  const queryClient = useQueryClient()
  const { user } = useSession()
  const { data: members } = useWorkspaceMembers(workspaceId)
  const people = members?.map((member) => member.user) ?? []

  const send = useMutation({
    ...sendMessageMutation(),
    onSuccess: async () => {
      setFailed(null)
      onSent?.()
      // The history is the source of truth; ask it again for what we just added.
      await queryClient.invalidateQueries({
        queryKey: listMessagesInfiniteQueryKey({ path: { channelId } }),
      })
    },
  })

  const { ref: registerContent, ...contentField } = register('content', {
    onChange: (event: { target: HTMLTextAreaElement }) => {
      setCaret(event.target.selectionStart)
      setDismissed(false)
      setActiveIndex(0)
    },
  })

  const mention = mentionQueryAt(text, caret)
  const suggestions =
    mention && !dismissed
      ? people
          .filter(
            (person) =>
              person.id !== user?.id &&
              person.nickname
                .toLocaleLowerCase('ru')
                .startsWith(mention.query.toLocaleLowerCase('ru')),
          )
          .slice(0, MAX_SUGGESTIONS)
      : []
  const open = suggestions.length > 0
  const active = suggestions.length === 0 ? 0 : Math.min(activeIndex, suggestions.length - 1)
  const activePerson = suggestions[active]
  const activeOptionId = activePerson ? optionId(listId, activePerson) : undefined

  // After a chosen nickname is inserted, the caret belongs right after it, not
  // at the end of the whole text.
  useLayoutEffect(() => {
    const position = caretRef.current
    if (position === null) return
    caretRef.current = null
    const field = fieldRef.current
    if (!field) return
    field.focus()
    field.setSelectionRange(position, position)
  })

  const submit = (attempt: Attempt) => {
    setFailed(null)
    const mentions = mentionedIds(attempt.content, people)
    send.mutate(
      {
        path: { channelId },
        body: {
          clientMessageId: attempt.clientMessageId,
          content: attempt.content,
          ...(attempt.replyToId === undefined ? {} : { replyToId: attempt.replyToId }),
          ...(mentions.length === 0 ? {} : { mentions }),
          ...(attempt.attachmentIds.length === 0
            ? {}
            : { attachmentIds: [...attempt.attachmentIds] }),
        },
      },
      {
        onError: () => {
          // Keep the id: the retry must not create a second message.
          setFailed(attempt)
        },
      },
    )
  }

  const content = text.trim()
  // Text or files, and nothing still uploading: a message must not lose a file
  // that has not finished yet.
  const canSend =
    (content !== '' || attachmentIds.length > 0) && !attachmentsBusy && !send.isPending

  const handleSubmit = () => {
    if (!canSend) return
    reset()
    setCaret(0)
    setDismissed(true)
    submit({
      clientMessageId: crypto.randomUUID(),
      content,
      ...(replyTo === undefined ? {} : { replyToId: replyTo.id }),
      attachmentIds,
    })
    onSending?.()
  }

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...event.clipboardData.files]
    if (files.length === 0 || !onPasteFiles) return
    // A pasted screenshot goes in as a file, not as its name in the text.
    event.preventDefault()
    onPasteFiles(files)
  }

  const choose = (person: User) => {
    if (!mention) return
    const before = text.slice(0, mention.start)
    const after = text.slice(caret)
    const inserted = `@${person.nickname} `
    const position = before.length + inserted.length
    caretRef.current = position
    setValue('content', `${before}${inserted}${after}`)
    setCaret(position)
    setDismissed(true)
    setActiveIndex(0)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        const next = (active + step + suggestions.length) % suggestions.length
        setActiveIndex(next)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        if (activePerson) choose(activePerson)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setDismissed(true)
        return
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border p-4">
      {replyTo && (
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <span className="truncate">
            Ответ на сообщение {authorName(replyTo)}: {messagePreview(replyTo)}
          </span>
          <Button size="sm" variant="ghost" aria-label="Отменить ответ" onClick={onCancelReply}>
            Отмена
          </Button>
        </div>
      )}
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
      {attachments}
      {attachmentsBusy && (
        <p className="sr-only" role="status">
          Ждём, пока загрузятся файлы.
        </p>
      )}
      <div className="flex items-end gap-2">
        {attachControl}
        <div className="relative flex-1">
          {open && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Подсказки упоминаний"
              className="absolute bottom-full left-0 z-10 mb-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-lg"
            >
              {suggestions.map((person, index) => (
                <li key={person.id} role="presentation">
                  <button
                    id={optionId(listId, person)}
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    className="w-full truncate rounded px-2 py-1 text-left text-sm text-fg hover:bg-surface-hover aria-selected:bg-surface-hover"
                    onMouseDown={(event) => {
                      // Keep the caret in the field: a blur would close the list first.
                      event.preventDefault()
                      choose(person)
                    }}
                  >
                    {person.nickname}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label htmlFor={fieldId} className="sr-only">
            Сообщение
          </label>
          <textarea
            id={fieldId}
            rows={1}
            {...contentField}
            ref={(element) => {
              registerContent(element)
              fieldRef.current = element
            }}
            placeholder="Напишите сообщение"
            maxLength={4000}
            aria-autocomplete="list"
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open ? activeOptionId : undefined}
            aria-describedby={open ? hintId : undefined}
            className="max-h-40 min-h-10 w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            onSelect={(event) => {
              setCaret(event.currentTarget.selectionStart)
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={() => {
              setDismissed(true)
            }}
          />
        </div>
        <Button disabled={!canSend} onClick={handleSubmit}>
          Отправить
        </Button>
      </div>
      {open && (
        <p id={hintId} className="sr-only">
          Стрелки вверх и вниз выбирают участника, Enter вставляет, Escape закрывает подсказки.
        </p>
      )}
    </div>
  )
}

const optionId = (listId: string, person: User): string => {
  return `${listId}-${person.id}`
}

const mentionQueryAt = (value: string, caret: number): MentionQuery | null => {
  const before = value.slice(0, caret)
  const match = /(?:^|\s)@([^\s@]*)$/u.exec(before)
  if (!match) return null
  const query = match[1] ?? ''
  return { start: before.length - query.length - 1, query }
}

const describeError = (error: unknown): string => {
  if (!isApiError(error)) return 'Сообщение не отправилось.'
  if (error.isNetworkError) return 'Нет соединения с сервером.'
  if (error.status === 403) return 'В этом канале вы не можете писать.'
  return 'Сообщение не отправилось.'
}
