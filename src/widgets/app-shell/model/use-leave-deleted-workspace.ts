import { useEffect } from 'react'
import { useNavigate } from 'react-router'

import { useLive } from '@/entities/live'
import { useVoiceRoom } from '@/entities/voice-room'
import { useToast } from '@/shared/ui/toast'

/**
 * The owner deleted a server. The rail loses it through the cache
 * (`applyEvent`); here the person is taken out of it: a voice call in it is
 * left, and a page open on it goes back to the start with a word on why.
 */
export const useLeaveDeletedWorkspace = (workspaceId: string | undefined) => {
  const { listen } = useLive()
  const { activeChannel, leave } = useVoiceRoom()
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    return listen((event) => {
      if (event.type !== 'workspace.deleted' || event.workspaceId === undefined) {
        return
      }
      if (activeChannel?.workspaceId === event.workspaceId) {
        void leave()
      }
      if (event.workspaceId === workspaceId) {
        toast('Сервер удалён.')
        void navigate('/', { replace: true })
      }
    })
  }, [listen, activeChannel, leave, workspaceId, navigate, toast])
}
