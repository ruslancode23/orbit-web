import { useId, useState } from 'react'
import { useNavigate } from 'react-router'

import { useStartConversation } from '@/entities/conversation'
import { useSession } from '@/entities/session'
import { UserAvatar, UserName, userDisplayName } from '@/entities/user'
import { isApiError, type UserProfile } from '@/shared/api'
import { Button, type ButtonProps } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog'
import { SearchIcon, XIcon } from '@/shared/ui/icon'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'
import { useToast } from '@/shared/ui/toast'

import { usePeopleToWrite } from '../model/people'

interface StartConversationProps {
  className?: string
  size?: ButtonProps['size']
  variant?: ButtonProps['variant']
  /** The visible text of the trigger; «Написать» by default. */
  label?: string
}

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
 * «Написать»: picks a person from the servers this account shares and opens
 * the pair dialogue with them, or the one that already exists. The empty
 * personal-messages section and its main pane both lead here.
 *
 * The dialog is mounted only while it is open: an empty section must not ask
 * for the members of every server just to draw one button.
 */
export const StartConversation = ({
  className,
  size = 'md',
  variant = 'primary',
  label = 'Написать',
}: StartConversationProps) => {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size={size} variant={variant} className={className}>
          {label}
        </Button>
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

const StartConversationDialog = ({ onClose }: { onClose: () => void }) => {
  const fieldId = useId()
  const [search, setSearch] = useState('')
  const { user } = useSession()
  const { people, isPending, error } = usePeopleToWrite()
  const start = useStartConversation()
  const navigate = useNavigate()
  const toast = useToast()

  const query = search.trim().toLocaleLowerCase('ru')
  const available = people.filter((person) => person.id !== user?.id && matches(person, query))

  const begin = (person: UserProfile) => {
    start.mutate(
      { body: { userIds: [person.id] } },
      {
        onSuccess: (conversation) => {
          onClose()
          void navigate(`/me/${conversation.id}`)
        },
        onError: (failure) => {
          toast(
            isApiError(failure) && failure.message !== ''
              ? failure.message
              : 'Не удалось начать диалог. Попробуйте ещё раз.',
            'danger',
          )
        },
      },
    )
  }

  return (
    <DialogContent className="max-w-md">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <DialogTitle>Написать</DialogTitle>
          <DialogDescription>
            Выберите человека из ваших серверов — откроется ваш диалог с ним.
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

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-muted" />
        <Input
          id={fieldId}
          type="search"
          aria-label="Поиск человека"
          placeholder="Имя или ник"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
          }}
          className="pl-8"
        />
      </div>

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
            : 'Никого не нашли.'}
        </p>
      ) : (
        <ul aria-label="Люди" className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
          {available.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                aria-label={`Написать ${userDisplayName(person)}`}
                disabled={start.isPending}
                onClick={() => {
                  begin(person)
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-fg hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50"
              >
                <UserAvatar profile={person} size={32} decorative />
                <UserName profile={person} className="min-w-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </DialogContent>
  )
}
