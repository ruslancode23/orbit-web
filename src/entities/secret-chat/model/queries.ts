import { useQuery } from '@tanstack/react-query'

import { listSecretChatsOptions, listUserDevicesOptions } from '@/shared/api'
import type { SecretChat } from '@/shared/api'
import { readSecretDevice, type StoredSecretDevice } from '@/shared/lib/secret-device'
import { getPlatform } from '@/shared/platform'

/** The device that holds this browser's secret chat keys, if it has one yet. */
export const useSecretDevice = () =>
  useQuery<StoredSecretDevice | null>({
    queryKey: ['secret-device'],
    queryFn: () => readSecretDevice(getPlatform().secretStore),
    staleTime: Number.POSITIVE_INFINITY,
  })

/** The secret chats of this device; another device has its own list. */
export const useSecretChats = (deviceId: string | undefined) =>
  useQuery({
    ...listSecretChatsOptions({ headers: { 'X-Orbit-Device': deviceId ?? '' } }),
    enabled: Boolean(deviceId),
    select: (chats: SecretChat[]) => chats,
  })

/** Which devices a person uses, so a secret chat can name one of them. */
export const useUserDevices = (userId: string | undefined) =>
  useQuery({
    ...listUserDevicesOptions({ path: { userId: userId ?? '' } }),
    enabled: Boolean(userId),
  })

/** Both secret chats of this device and of the account's other devices. */
export const secretChatName = (chat: SecretChat): string => chat.peer.nickname
