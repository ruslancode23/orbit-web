import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import {
  describeConversationError,
  useAddConversationMembers,
  type Conversation,
} from '@/entities/conversation'
import { useFriends } from '@/entities/friend'
import { UserAvatar } from '@/entities/user'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'

interface AddMembersDialogProps {
  conversation: Conversation
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface AddValues {
  userIds: string[]
}

/** The server refuses more than twenty people in one group at once. */
const MAX_ADDED = 20

/**
 * Adds friends who are not in the group yet. The server ignores people who are
 * already there and answers 409 for a direct dialogue, which is shown as a
 * sentence rather than a crash.
 */
const AddMembersDialog = ({ conversation, open, onOpenChange }: AddMembersDialogProps) => {
  const titleId = useId()
  const friends = useFriends()
  const add = useAddConversationMembers()
  const { register, handleSubmit, control } = useForm<AddValues>({
    defaultValues: { userIds: [] },
  })
  const selected = useWatch({ control, name: 'userIds' })

  const inside = new Set(conversation.members.map((member) => member.id))
  const available = (friends.data ?? []).filter((friend) => !inside.has(friend.id))

  const submit = handleSubmit(async (values) => {
    if (values.userIds.length === 0) {
      return
    }
    const updated = await add
      .mutateAsync({
        path: { conversationId: conversation.id },
        body: { userIds: values.userIds },
      })
      .catch(() => null)
    if (updated) {
      onOpenChange(false)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="flex flex-col gap-1">
          <DialogTitle>Добавить людей</DialogTitle>
          <DialogDescription>
            Друзья, которых ещё нет в группе. Уже добавленных сервер пропустит.
          </DialogDescription>
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          {friends.isPending ? (
            <p role="status" className="text-sm text-fg-muted">
              Загружаем друзей…
            </p>
          ) : friends.error ? (
            <p role="alert" className="text-sm text-danger">
              Не получилось загрузить друзей.
            </p>
          ) : available.length === 0 ? (
            <p className="text-sm text-fg-muted">
              Все ваши друзья уже в группе. Добавьте друзей, чтобы приглашать их сюда.
            </p>
          ) : (
            <fieldset className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              <legend id={titleId} className="sr-only">
                Кого добавить
              </legend>
              <ul aria-labelledby={titleId} className="flex flex-col gap-0.5">
                {available.map((friend) => {
                  const checked = selected.includes(friend.id)
                  return (
                    <li key={friend.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-hover">
                        <input
                          type="checkbox"
                          value={friend.id}
                          disabled={!checked && selected.length >= MAX_ADDED}
                          className="size-4 shrink-0 accent-accent"
                          {...register('userIds')}
                        />
                        <UserAvatar
                          profile={{ nickname: friend.nickname, displayName: friend.nickname }}
                          size={20}
                          decorative
                        />
                        <span className="min-w-0 flex-1 truncate">{friend.nickname}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </fieldset>
          )}

          {add.error && (
            <p role="alert" className="text-sm text-danger">
              {describeConversationError(add.error, 'Не получилось добавить людей.')}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Отмена
              </Button>
            </DialogClose>
            <Button type="submit" disabled={add.isPending || selected.length === 0}>
              Добавить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default AddMembersDialog
