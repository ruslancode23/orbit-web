import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'

import {
  searchMessagesInfiniteOptions,
  type MessageSearchHit,
  type SearchMessagesData,
} from '@/shared/api'
import { usePageVisible } from '@/shared/lib/page-visibility'
import { hashQueryKeyWithBigints } from '@/shared/lib/query-key'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { SearchIcon, XIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'

import { formatRelativeTime } from '../model/message'
import { searchHitHref, searchHitPlace, splitHeadline } from '../model/search'

/** One account the «от кого» filter offers. */
export interface SearchPerson {
  id: string
  nickname: string
  displayName?: string
}

/** Which targets the dialog offers: a channel/server pair, or a dialogue. */
export type SearchScope = 'channel' | 'workspace' | 'conversation' | 'conversations'

interface MessageSearchProps {
  workspaceId?: string
  channelId?: string
  conversationId?: string
  /** Whom the author filter lists; without them the filter is not drawn. */
  people?: readonly SearchPerson[]
  /** The scope the dialog starts in; the one the person opened it from. */
  defaultScope?: SearchScope
  /**
   * Without `open` the component draws its own button and listens for `/`.
   * With it the caller controls the dialog from a menu item.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** The `/` shortcut; off for a dialog that lives in a menu. */
  hotkey?: boolean
}

const DEBOUNCE_MS = 250

const scopeLabel = (scope: SearchScope): string => {
  switch (scope) {
    case 'channel':
      return 'В канале'
    case 'workspace':
      return 'На сервере'
    case 'conversation':
      return 'В беседе'
    case 'conversations':
      return 'Во всех беседах'
  }
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  )
}

/**
 * Full-text search over what the account may read. The dialog opens from a
 * header button, from the `/` key, or from a caller that owns an open state.
 * Results are pointers: a click opens the channel at the message.
 */
export const MessageSearch = ({
  workspaceId,
  channelId,
  conversationId,
  people,
  defaultScope,
  open,
  onOpenChange,
  hotkey = true,
}: MessageSearchProps) => {
  const navigate = useNavigate()
  const pageVisible = usePageVisible()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [text, setText] = useState('')
  const [debounced, setDebounced] = useState('')
  const [scope, setScope] = useState<SearchScope>(
    defaultScope ?? (conversationId === undefined ? 'channel' : 'conversation'),
  )
  const [authorId, setAuthorId] = useState('')
  const [hasFiles, setHasFiles] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const isOpen = open ?? uncontrolledOpen
  const requestOpen = (next: boolean) => {
    if (onOpenChange === undefined) {
      setUncontrolledOpen(next)
    } else {
      onOpenChange(next)
    }
  }

  // `/` opens the search, unless the person is typing in a field.
  useEffect(() => {
    if (open !== undefined || !hotkey) {
      return undefined
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) {
        return
      }
      if (isTypingTarget(event.target)) {
        return
      }
      event.preventDefault()
      setUncontrolledOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, hotkey])

  // The field takes focus when the dialog opens, without an autofocus attribute.
  useEffect(() => {
    if (!isOpen) {
      return
    }
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [isOpen])

  // A search after every keystroke would be a query per letter.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(text.trim())
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [text])

  const query = useMemo<SearchMessagesData['query']>(() => {
    const base: SearchMessagesData['query'] = { q: debounced }
    if (scope === 'channel' && channelId !== undefined) {
      base.channelId = channelId
    } else if (scope === 'workspace' && workspaceId !== undefined) {
      base.workspaceId = workspaceId
    } else if (scope === 'conversation' && conversationId !== undefined) {
      base.conversationId = conversationId
    } else if (scope === 'conversations') {
      base.conversationsOnly = true
    }
    if (authorId !== '') {
      base.authorId = authorId
    }
    if (hasFiles) {
      base.hasFiles = true
    }
    return base
  }, [debounced, scope, channelId, workspaceId, conversationId, authorId, hasFiles])

  const search = useInfiniteQuery({
    ...searchMessagesInfiniteOptions({ query }),
    initialPageParam: { query },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: isOpen && debounced !== '',
    // A cursor is a bigint; the default hash cannot serialize one.
    queryKeyHashFn: hashQueryKeyWithBigints,
  })

  const hits: MessageSearchHit[] = []
  for (const page of search.data?.pages ?? []) {
    hits.push(...page.items)
  }
  const scopes: SearchScope[] =
    conversationId === undefined ? ['channel', 'workspace'] : ['conversation', 'conversations']

  const openHit = (hit: MessageSearchHit) => {
    requestOpen(false)
    void navigate(searchHitHref(hit))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      setDebounced(text.trim())
    }
  }

  const dialog = (
    <Dialog open={isOpen} onOpenChange={requestOpen}>
      <DialogContent className="top-24 max-h-[70vh] max-w-2xl translate-y-0 gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <DialogTitle className="text-base">Поиск сообщений</DialogTitle>
            <DialogDescription className="text-xs text-fg-muted">
              Найдётся только то, что вы можете прочитать.
            </DialogDescription>
          </div>
          <IconButton
            label="Закрыть поиск"
            size="sm"
            onClick={() => {
              requestOpen(false)
            }}
          >
            <XIcon className="size-4" />
          </IconButton>
        </div>

        <form
          role="search"
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            setDebounced(text.trim())
          }}
        >
          <Label htmlFor="message-search" className="sr-only">
            Поиск по сообщениям
          </Label>
          <Input
            id="message-search"
            ref={inputRef}
            value={text}
            placeholder="Слова из сообщения"
            onChange={(event) => {
              setText(event.target.value)
            }}
            onKeyDown={handleKeyDown}
          />
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Где искать" className="flex gap-1">
              {scopes.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={scope === option ? 'primary' : 'ghost'}
                  size="sm"
                  aria-pressed={scope === option}
                  onClick={() => {
                    setScope(option)
                  }}
                >
                  {scopeLabel(option)}
                </Button>
              ))}
            </div>
            {people !== undefined && people.length > 0 && (
              <Label className="flex items-center gap-1 text-xs text-fg-muted">
                От кого
                <select
                  aria-label="Автор"
                  className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg"
                  value={authorId}
                  onChange={(event) => {
                    setAuthorId(event.target.value)
                  }}
                >
                  <option value="">Любой</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.displayName
                        ? `${person.displayName} (@${person.nickname})`
                        : person.nickname}
                    </option>
                  ))}
                </select>
              </Label>
            )}
            <Label className="flex items-center gap-2 text-xs text-fg-muted">
              <Switch
                checked={hasFiles}
                onCheckedChange={(next) => {
                  setHasFiles(next)
                }}
              />
              С файлами
            </Label>
          </div>
        </form>

        <div className="min-h-24 overflow-y-auto pr-1">
          {!pageVisible && (
            <p className="text-xs text-fg-muted">Вкладка не видна — результаты обновятся.</p>
          )}
          {debounced === '' && <p className="text-sm text-fg-muted">Введите слово или фразу.</p>}
          {debounced !== '' && search.isPending && (
            <p role="status" className="text-sm text-fg-muted">
              Ищем…
            </p>
          )}
          {search.error !== null && (
            <p role="alert" className="text-sm text-danger">
              Не получилось найти сообщения.
            </p>
          )}
          {debounced !== '' && !search.isPending && search.error === null && hits.length === 0 && (
            <p className="text-sm text-fg-muted">Ничего не найдено.</p>
          )}
          <ul className="flex flex-col gap-1" aria-label="Результаты поиска">
            {hits.map((hit) => (
              <li key={hit.message.id}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-1 rounded-md px-2 py-2 text-left hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                  onClick={() => {
                    openHit(hit)
                  }}
                >
                  <span className="flex items-center justify-between gap-2 text-xs text-fg-muted">
                    <span className="truncate font-semibold">{searchHitPlace(hit)}</span>
                    <span className="shrink-0">{formatRelativeTime(hit.message.createdAt)}</span>
                  </span>
                  <span className="truncate text-xs text-fg-muted">
                    {hit.message.author === undefined
                      ? 'Удалённый пользователь'
                      : hit.message.author.displayName || hit.message.author.nickname}
                  </span>
                  <span className="text-sm break-words text-fg">
                    {splitHeadline(hit.headline).map((part, index) =>
                      part.highlighted ? (
                        <mark key={index} className="rounded bg-accent/30 text-fg">
                          {part.text}
                        </mark>
                      ) : (
                        <span key={index}>{part.text}</span>
                      ),
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {search.hasNextPage && (
            <Button
              variant="ghost"
              size="sm"
              disabled={search.isFetchingNextPage}
              onClick={() => {
                void search.fetchNextPage()
              }}
            >
              Показать ещё
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )

  if (open !== undefined) {
    return dialog
  }
  return (
    <>
      <IconButton
        label="Поиск по сообщениям"
        onClick={() => {
          requestOpen(true)
        }}
      >
        <SearchIcon />
      </IconButton>
      {dialog}
    </>
  )
}
