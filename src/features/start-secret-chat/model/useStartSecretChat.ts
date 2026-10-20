import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { useSession } from '@/entities/session'
import { isApiError, listUserDevices } from '@/shared/api'
import type { Device } from '@/shared/api'
import { getPlatform } from '@/shared/platform'
import { useToast } from '@/shared/ui/toast'

interface Target {
  userId: string
  nickname: string
}

/**
 * Starts the secret chat of two devices and opens it. The crypto stack is
 * imported only now, so a member card or a dialogue menu costs nothing until
 * the person actually asks for a secret chat.
 */
export const useStartSecretChat = () => {
  const { user } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const [target, setTarget] = useState<Target | null>(null)
  const [devices, setDevices] = useState<Device[] | null>(null)

  const refreshLists = async () => {
    await queryClient.invalidateQueries({ queryKey: ['secret-device'] })
    await queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === 'listSecretChats' || query.queryKey[0] === 'listConversations',
    })
  }

  const openChat = async (userId: string, peerDeviceId?: string) => {
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
      await refreshLists()
      setDevices(null)
      setTarget(null)
      void navigate(`/me/s/${chat.id}`)
    } catch (error) {
      toast(isApiError(error) ? error.message : 'Не удалось начать секретный чат', 'danger')
    } finally {
      setPending(false)
    }
  }

  const start = async (userId: string, nickname: string) => {
    if (!user) {
      return
    }
    setTarget({ userId, nickname })
    setPending(true)
    try {
      const { data } = await listUserDevices({ path: { userId } })
      if (data.length === 0) {
        toast(`У ${nickname} ещё нет устройства для секретных чатов`, 'info')
        setTarget(null)
        return
      }
      const only = data[0]
      if (data.length === 1 && only) {
        await openChat(userId, only.id)
        return
      }
      setDevices(data)
    } catch (error) {
      toast(isApiError(error) ? error.message : 'Не удалось начать секретный чат', 'danger')
      setTarget(null)
    } finally {
      setPending(false)
    }
  }

  const openWith = async (peerDeviceId?: string) => {
    if (!target) {
      return
    }
    await openChat(target.userId, peerDeviceId)
  }

  const reset = () => {
    setDevices(null)
    setTarget(null)
  }

  return { pending, target, devices, start, openWith, reset }
}
