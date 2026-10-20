import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { useSession } from '@/entities/session'
import { isApiError, listUserDevices } from '@/shared/api'
import type { Device } from '@/shared/api'
import { getPlatform } from '@/shared/platform'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { useToast } from '@/shared/ui/toast'

interface StartSecretChatProps {
  userId: string
  nickname: string
}

/**
 * «Секретный чат» on a member card. The crypto stack is imported only when the
 * button is pressed: opening a server must not download libolm.
 */
export const StartSecretChat = ({ userId, nickname }: StartSecretChatProps) => {
  const { user } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const [devices, setDevices] = useState<Device[] | null>(null)

  const openWith = async (peerDeviceId?: string) => {
    if (!user) {
      return
    }
    setPending(true)
    try {
      const { SecretSession, serverSecretApi } = await import('@/entities/secret-session')
      const session = await SecretSession.open(
        serverSecretApi,
        getPlatform().secretStore,
        user.id,
        'Этот браузер',
      )
      const chat = await session.startChat(userId, peerDeviceId)
      // The sidebar and the screen read the list by name: refresh it before
      // opening, because the new chat is not in the cached list yet.
      await queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'listSecretChats' || query.queryKey[0] === 'listConversations',
      })
      setDevices(null)
      void navigate(`/dm/s/${chat.id}`)
    } catch (error) {
      toast(isApiError(error) ? error.message : 'Не удалось начать секретный чат', 'danger')
    } finally {
      setPending(false)
    }
  }

  const start = async () => {
    if (!user) {
      return
    }
    setPending(true)
    try {
      const { data } = await listUserDevices({ path: { userId } })
      if (data.length === 0) {
        toast(`У ${nickname} ещё нет устройства для секретных чатов`, 'info')
        return
      }
      const only = data[0]
      if (data.length === 1 && only) {
        await openWith(only.id)
        return
      }
      setDevices(data)
    } catch (error) {
      toast(isApiError(error) ? error.message : 'Не удалось начать секретный чат', 'danger')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => void start()}>
        Секретный чат
      </Button>
      <Dialog
        open={devices !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDevices(null)
          }
        }}
      >
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
                  void openWith(device.id)
                }}
              >
                {device.name || 'Устройство без имени'}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
