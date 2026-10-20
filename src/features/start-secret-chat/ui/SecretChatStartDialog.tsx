import type { Device } from '@/shared/api'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'

interface SecretChatStartDialogProps {
  nickname: string
  devices: Device[] | null
  pending: boolean
  onChoose: (deviceId: string) => void
  onOpenChange: (open: boolean) => void
}

/** Only shown when the peer has more than one device to pick from. */
export const SecretChatStartDialog = ({
  nickname,
  devices,
  pending,
  onChoose,
  onOpenChange,
}: SecretChatStartDialogProps) => {
  return (
    <Dialog open={devices !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Устройство собеседника</DialogTitle>
        <DialogDescription>
          Секретный чат привязан к устройству: выберите, на каком устройстве {nickname} будете
          читать переписку. На остальных её не будет.
        </DialogDescription>
        <div className="flex flex-col gap-1">
          {(devices ?? []).map((device) => (
            <Button
              key={device.id}
              variant="secondary"
              className="justify-start"
              disabled={pending}
              onClick={() => {
                onChoose(device.id)
              }}
            >
              {device.name || 'Устройство без имени'}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
