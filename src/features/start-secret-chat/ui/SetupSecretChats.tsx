import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { useSession } from '@/entities/session'
import { isApiError } from '@/shared/api'
import { getPlatform } from '@/shared/platform'
import { Button } from '@/shared/ui/button'
import { useToast } from '@/shared/ui/toast'

/**
 * Turns secret chats on for this browser: creates the device keys and publishes
 * the first one-time keys. libolm is imported only now, not when the app opens.
 */
export const SetupSecretChats = () => {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [pending, setPending] = useState(false)

  const enable = async () => {
    if (!user) {
      return
    }
    setPending(true)
    try {
      const { SecretSession, serverSecretApi } = await import('@/entities/secret-session')
      await SecretSession.open(serverSecretApi, getPlatform().secretStore, user.id, 'Этот браузер')
      await queryClient.invalidateQueries({ queryKey: ['secret-device'] })
      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'listSecretChats',
      })
      toast('Секретные чаты включены на этом устройстве', 'success')
    } catch (error) {
      toast(isApiError(error) ? error.message : 'Не удалось включить секретные чаты', 'danger')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-panel border border-border p-3">
      <p className="text-xs text-fg-muted">
        Секретные чаты шифруются на этом устройстве. Включите их, чтобы собеседник мог начать с вами
        переписку, которую сервер не прочитает.
      </p>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => void enable()}>
        {pending ? 'Включаем…' : 'Включить секретные чаты'}
      </Button>
    </div>
  )
}
