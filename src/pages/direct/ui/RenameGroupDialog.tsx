import { useId } from 'react'
import { useForm } from 'react-hook-form'

import { describeConversationError, useRenameConversation } from '@/entities/conversation'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

interface RenameGroupDialogProps {
  conversationId: string
  name: string | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface RenameValues {
  name: string
}

/** Renames a group; a direct dialogue answers 409 and the reason is shown as is. */
const RenameGroupDialog = ({
  conversationId,
  name,
  open,
  onOpenChange,
}: RenameGroupDialogProps) => {
  const nameId = useId()
  const rename = useRenameConversation()
  const { register, handleSubmit, formState } = useForm<RenameValues>({
    defaultValues: { name: name ?? '' },
  })

  const submit = handleSubmit(async (values) => {
    const updated = await rename
      .mutateAsync({ path: { conversationId }, body: { name: values.name.trim() } })
      .catch(() => null)
    if (updated) {
      onOpenChange(false)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="flex flex-col gap-1">
          <DialogTitle>Переименовать группу</DialogTitle>
          <DialogDescription>Название видят все участники группы.</DialogDescription>
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor={nameId}>Название группы</Label>
            <Input
              id={nameId}
              maxLength={100}
              aria-invalid={formState.errors.name ? true : undefined}
              {...register('name', {
                validate: (value) => value.trim().length > 0 || 'Название не может быть пустым.',
              })}
            />
            {formState.errors.name?.message && (
              <p role="alert" className="text-xs text-danger">
                {formState.errors.name.message}
              </p>
            )}
          </div>

          {rename.error && (
            <p role="alert" className="text-sm text-danger">
              {describeConversationError(rename.error, 'Не получилось переименовать группу.')}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Отмена
              </Button>
            </DialogClose>
            <Button type="submit" disabled={rename.isPending}>
              Сохранить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default RenameGroupDialog
