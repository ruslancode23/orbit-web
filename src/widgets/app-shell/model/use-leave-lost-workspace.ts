import { useEffect } from 'react'
import { useNavigate } from 'react-router'

import { useLive, type LiveEvent } from '@/entities/live'
import { useSession } from '@/entities/session'
import { useVoiceRoom } from '@/entities/voice-room'
import { useToast } from '@/shared/ui/toast'

/**
 * Why this account just lost a server, or nothing: the owner deleted it, or
 * this account was kicked or banned (member.changed about itself, no longer
 * present).
 */
const lossOf = (event: LiveEvent, userId: string | undefined): string | undefined => {
  if (event.type === 'workspace.deleted') {
    return 'Сервер удалён.'
  }
  if (event.type !== 'member.changed' || userId === undefined) {
    return undefined
  }
  const payload = event.payload
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'userId' in payload &&
    payload.userId === userId &&
    'present' in payload &&
    payload.present === false
  ) {
    return 'Вы больше не участник этого сервера.'
  }
  return undefined
}

/**
 * The account lost a server: the owner deleted it, or someone removed this
 * account from it. The rail loses it through the cache (`applyEvent`); here
 * the person is taken out of it: a voice call in it is left, and a page open
 * on it goes back to the start with a word on why.
 */
export const useLeaveLostWorkspace = (workspaceId: string | undefined) => {
  const { listen } = useLive()
  const { user } = useSession()
  const { activeChannel, leave } = useVoiceRoom()
  const navigate = useNavigate()
  const toast = useToast()
  const userId = user?.id

  useEffect(() => {
    return listen((event) => {
      if (event.workspaceId === undefined) {
        return
      }
      const reason = lossOf(event, userId)
      if (reason === undefined) {
        return
      }
      if (activeChannel?.workspaceId === event.workspaceId) {
        void leave()
      }
      if (event.workspaceId === workspaceId) {
        toast(reason)
        void navigate('/', { replace: true })
      }
    })
  }, [listen, userId, activeChannel, leave, workspaceId, navigate, toast])
}
