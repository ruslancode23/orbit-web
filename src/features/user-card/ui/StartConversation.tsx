import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'

import {
  describeConversationStartError,
  useStartConversation,
  useStartGroupConversation,
} from '@/entities/conversation'
import { useSession } from '@/entities/session'
import { UserAvatar, UserName, userDisplayName } from '@/entities/user'
import type { UserProfile } from '@/shared/api'
import { cn } from '@/shared/lib/cn'
import { Button, type ButtonProps } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog'
import { MessageIcon, SearchIcon, XIcon } from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Skeleton } from '@/shared/ui/skeleton'
import { useToast } from '@/shared/ui/toast'

import { usePeopleToWrite } from '../model/people'

interface StartConversationProps {
  className?: string
  size?: ButtonProps['size']
  variant?: ButtonProps['variant']
  /** The visible text of the trigger; «Написать» by default. */
  label?: string
  /** Draws only the picture; `label` becomes the accessible name and the hint. */
  iconOnly?: boolean
}

/** The conversation endpoint takes at most twenty people besides the caller. */
const MAX_SELECTED = 20

const matches = (person: UserProfile, query: string): boolean => {
  if (query === '') {
    return true
  }
  return (
    userDisplayName(person).toLocaleLowerCase('ru').includes(query) ||
    person.nickname.toLocaleLowerCase('ru').includes(query)
  )
}

/**
 * «Написать»: picks people from the servers this account shares. One person
 * opens the pair dialogue — the existing one or a new one; several create a
 * group, whose title is optional. The empty personal-messages section and the
 * sidebar header both lead here.
 *
 * The dialog is mounted only while it is open: an empty section must not ask
 * for the members of every server just to draw one button.
 */
export const StartConversation = ({
  className,
  size = 'md',
  variant = 'primary',
  label = 'Написать',
  iconOnly = false,
}: StartConversationProps) => {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {iconOnly ? (
          <IconButton label={label} className={className}>
            <MessageIcon />
          </IconButton>
        ) : (
          <Button type="button" size={size} variant={variant} className={className}>
            {label}
          </Button>
        )}
      </DialogTrigger>
      {open && (
        <StartConversationDialog
          onClose={() => {
            setOpen(false)
          }}
        />
      )}
    </Dialog>
  )
}

interface StartConversationValues {
  name: string
}

const StartConversationDialog = ({ onClose }: { onClose: () => void }) => {
  const listboxId = useId()
  const limitId = useId()
  const nameId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<UserProfile[]>([])
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const { user } = useSession()
  const { people, isPending, error } = usePeopleToWrite()
  const startDirect = useStartConversation()
  const startGroup = useStartGroupConversation()
  const { register, handleSubmit } = useForm<StartConversationValues>({
    defaultValues: { name: '' },
  })
  const navigate = useNavigate()
  const toast = useToast()

  const query = search.trim().toLocaleLowerCase('ru')
  const selectedIds = new Set(selected.map((person) => person.id))
  const available = people.filter(
    (person) => person.id !== user?.id && !selectedIds.has(person.id) && matches(person, query),
  )
  const limitReached = selected.length >= MAX_SELECTED
  const active = available.length === 0 ? -1 : Math.min(activeIndex, available.length - 1)
  const pending = startDirect.isPending || startGroup.isPending
  const failure = startDirect.error ?? startGroup.error

  const optionId = (personId: string): string => `${listboxId}-${personId}`

  const resetFailure = () => {
    startDirect.reset()
    startGroup.reset()
  }

  const add = (person: UserProfile) => {
    if (selectedIds.has(person.id) || limitReached) {
      return
    }
    setSelected((current) => [...current, person])
    setSearch('')
    setActiveIndex(0)
    resetFailure()
  }

  const remove = (personId: string) => {
    setSelected((current) => current.filter((person) => person.id !== personId))
    setActiveIndex(0)
    resetFailure()
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (available.length > 0) {
        setActiveIndex((active + 1) % available.length)
      }
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (available.length > 0) {
        setActiveIndex((active - 1 + available.length) % available.length)
      }
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(Math.max(0, available.length - 1))
      return
    }
    if (event.key === 'Enter') {
      const person = available[active]
      if (person) {
        event.preventDefault()
        add(person)
      }
      return
    }
    // Backspace in an empty field takes away the last chip, as a token field
    // usually does; the X button of every chip works on its own as well.
    if (event.key === 'Backspace' && search === '') {
      const last = selected.at(-1)
      if (last) {
        event.preventDefault()
        remove(last.id)
      }
    }
  }

  // Leaving for the new dialogue: the focus must not go back to the trigger,
  // or the first keys typed land nowhere and Enter opens this dialog again.
  const [leaving, setLeaving] = useState(false)

  const openConversation = (conversationId: string) => {
    setLeaving(true)
    onClose()
    void navigate(`/me/${conversationId}`)
  }

  const submit = handleSubmit(({ name }) => {
    const userIds = selected.map((person) => person.id)
    if (userIds.length === 1) {
      startDirect.mutate(
        { body: { userIds } },
        {
          onSuccess: (conversation) => {
            openConversation(conversation.id)
          },
        },
      )
      return
    }
    if (userIds.length > 1) {
      const title = name.trim()
      startGroup.mutate(
        { userIds, ...(title === '' ? {} : { name: title }) },
        {
          onSuccess: ({ conversation, nameFailed }) => {
            openConversation(conversation.id)
            if (nameFailed) {
              toast('Группа создана, но название не сохранилось.', 'danger')
            }
          },
        },
      )
    }
  })

  const submitLabel = selected.length > 1 ? 'Создать группу' : 'Написать'

  return (
    <DialogContent
      className="max-h-[85vh] max-w-md overflow-y-auto"
      onOpenAutoFocus={(event) => {
        event.preventDefault()
        inputRef.current?.focus()
      }}
      onCloseAutoFocus={(event) => {
        if (leaving) {
          event.preventDefault()
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <DialogTitle>Новое сообщение</DialogTitle>
          <DialogDescription>
            Найдите людей из ваших серверов. Один человек — диалог, несколько — группа.
          </DialogDescription>
        </div>
        <DialogClose asChild>
          <button
            type="button"
            aria-label="Закрыть"
            title="Закрыть"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <XIcon />
          </button>
        </DialogClose>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {selected.length > 0 && (
          <ul aria-label="Выбранные люди" className="flex flex-wrap gap-1.5">
            {selected.map((person) => (
              <li key={person.id}>
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface py-0.5 pr-1 pl-2 text-sm">
                  <UserAvatar profile={person} size={20} decorative />
                  <span className="min-w-0 truncate">{userDisplayName(person)}</span>
                  <IconButton
                    label={`Убрать ${userDisplayName(person)}`}
                    size="sm"
                    onClick={() => {
                      remove(person.id)
                    }}
                  >
                    <XIcon className="size-3.5" />
                  </IconButton>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-muted" />
          <Input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-label="Поиск людей"
            aria-autocomplete="list"
            aria-expanded={available.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={
              active === -1 || !available[active] ? undefined : optionId(available[active].id)
            }
            aria-describedby={limitId}
            placeholder="Имя или ник"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={handleSearchKeyDown}
            className="pl-8"
          />
        </div>

        <p
          id={limitId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="text-xs text-fg-muted"
        >
          {selected.length === 0
            ? `Можно выбрать до ${String(MAX_SELECTED)} человек за раз.`
            : `Выбрано ${String(selected.length)} из ${String(MAX_SELECTED)}.`}
          {limitReached && ' Достигнут лимит участников.'}
        </p>

        {isPending ? (
          <div role="status" aria-label="Загружаем людей" className="flex flex-col gap-2">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-2">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p role="alert" className="text-sm text-danger">
            Не удалось загрузить людей.
          </p>
        ) : available.length === 0 ? (
          <p className="text-sm text-fg-muted">
            {people.length === 0
              ? 'Пока некого выбрать: вступите в сервер, чтобы написать его участникам.'
              : limitReached
                ? `Выбрали максимум — ${String(MAX_SELECTED)} человек.`
                : query === ''
                  ? 'Все люди из ваших серверов уже выбраны.'
                  : 'Никого не нашли.'}
          </p>
        ) : (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Люди"
            className="flex max-h-64 flex-col gap-0.5 overflow-y-auto"
          >
            {available.map((person, index) => (
              <li key={person.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  id={optionId(person.id)}
                  aria-selected={false}
                  tabIndex={-1}
                  disabled={limitReached}
                  onMouseDown={(event) => {
                    // The search field keeps the focus and the caret while a
                    // mouse picks an option, so typing can go on at once.
                    event.preventDefault()
                  }}
                  onClick={() => {
                    add(person)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-fg hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50',
                    index === active && 'bg-surface-hover',
                  )}
                >
                  <UserAvatar profile={person} size={32} decorative />
                  <UserName profile={person} className="min-w-0" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected.length > 1 && (
          <div className="flex flex-col gap-1">
            <Label htmlFor={nameId}>
              Название группы <span className="text-fg-muted">(необязательно)</span>
            </Label>
            <Input
              id={nameId}
              maxLength={100}
              placeholder="Например, «Планы на неделю»"
              {...register('name')}
            />
          </div>
        )}

        {failure && (
          <p role="alert" className="text-sm text-danger">
            {describeConversationStartError(failure)}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Отмена
            </Button>
          </DialogClose>
          <Button type="submit" disabled={pending || selected.length === 0}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}
