import { Button } from '@/shared/ui/button'

import { SecretChatStartDialog } from './SecretChatStartDialog'
import { useStartSecretChat } from '../model/useStartSecretChat'

interface StartSecretChatProps {
  userId: string
  nickname: string
}

/** «Секретный чат» as a button, for a member card. */
export const StartSecretChat = ({ userId, nickname }: StartSecretChatProps) => {
  const { pending, target, devices, start, openWith, reset } = useStartSecretChat()

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          void start(userId, nickname)
        }}
      >
        Секретный чат
      </Button>
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
