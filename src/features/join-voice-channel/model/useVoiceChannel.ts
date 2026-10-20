import { useMutation } from '@tanstack/react-query'

import { useVoiceRoom, type ActiveVoiceChannel } from '@/entities/voice-room'
import { createChannelVoiceTokenMutation, isApiError } from '@/shared/api'

/**
 * Connects to a voice channel by id: the server issues a token for the account
 * in the session, so there is no name to type. The provider keeps the room
 * alive while the reader walks through text channels and servers.
 */
export const useVoiceChannel = () => {
  const { join, leave, activeChannel, status, connectionLoss, error } = useVoiceRoom()
  const token = useMutation(createChannelVoiceTokenMutation())

  const enter = async (channel: ActiveVoiceChannel) => {
    if (token.isPending) {
      return
    }
    const access = await token.mutateAsync({ path: { channelId: channel.id } }).catch(() => null)
    if (!access) {
      return
    }
    await join({ url: access.url, token: access.token, channel })
  }

  const reconnect = async () => {
    if (activeChannel) {
      await enter(activeChannel)
    }
  }

  return {
    connect: enter,
    reconnect,
    leave,
    activeChannel,
    status,
    connectionLoss,
    connecting: token.isPending,
    error: token.error ? describeVoiceAccessError(token.error) : error,
  }
}

const describeVoiceAccessError = (error: unknown): string => {
  if (isApiError(error) && error.isNetworkError) {
    return 'Нет соединения с сервером.'
  }
  if (isApiError(error) && error.status === 404) {
    return 'Голосовой канал больше не существует.'
  }
  return 'Не получилось получить доступ к голосовому каналу.'
}
