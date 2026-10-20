import { DropdownMenuItem } from '@/shared/ui/dropdown-menu'

import { SecretChatStartDialog } from './SecretChatStartDialog'
import { useStartSecretChat } from '../model/useStartSecretChat'

interface SecretChatMenuItemProps {
  userId: string
  nickname: string
}

/**
 * «Секретный чат» in the menu of a dialogue: the chat with this person is
 * already open, and the secret one starts beside it.
 */
export const SecretChatMenuItem = ({ userId, nickname }: SecretChatMenuItemProps) => {
  const { pending, target, devices, start, openWith, reset } = useStartSecretChat()

  return (
    <>
      <DropdownMenuItem
        disabled={pending}
        onSelect={() => {
          void start(userId, nickname)
        }}
      >
        Секретный чат
      </DropdownMenuItem>
      <SecretChatStartDialog
        nickname={target?.nickname ?? nickname}
        devices={devices}
        pending={pending}
        onChoose={(deviceId) => {
          void openWith(deviceId)
        }}
        onOpenChange={(open) => {
          if (!open) {
            reset()
          }
        }}
      />
    </>
  )
}
