import { useNavigate } from 'react-router'

import { describeConversationError, useLeaveConversation } from '@/entities/conversation'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'

interface LeaveGroupDialogProps {
  conversationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Leaving is not hiding: access to the history, its files and the live stream
 * ends for this account. The page goes back to the list of dialogues.
 */
const LeaveGroupDialog = ({ conversationId, open, onOpenChange }: LeaveGroupDialogProps) => {
  const navigate = useNavigate()
  const leave = useLeaveConversation()

  const confirm = async () => {
    const left = await leave
      .mutateAsync({ path: { conversationId } })
      .then(() => true)
      .catch(() => false)
    if (!left) {
      return
    }
    onOpenChange(false)
    await navigate('/me')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="flex flex-col gap-1">
          <DialogTitle>Выйти из группы</DialogTitle>
          <DialogDescription>
            История и файлы станут недоступны. Вернуться можно будет только по новому приглашению.
          </DialogDescription>
        </div>

        {leave.error && (
          <p role="alert" className="text-sm text-danger">
            {describeConversationError(leave.error, 'Не получилось выйти из группы.')}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Отмена
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="danger"
            disabled={leave.isPending}
            onClick={() => {
              void confirm()
            }}
          >
            Выйти
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default LeaveGroupDialog
