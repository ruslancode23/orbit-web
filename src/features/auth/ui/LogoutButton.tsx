import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import { useForgetSession } from '@/entities/session'
import { logoutMutation } from '@/shared/api'
import { Button } from '@/shared/ui/button'

import { clearSecretChats } from '../model/clear-secret-chats'

interface LogoutButtonProps {
  /** Runs while the session is still alive, before the sign-out: device cleanup such as push. */
  beforeSignOut?: () => Promise<void>
}

export const LogoutButton = ({ beforeSignOut }: LogoutButtonProps) => {
  const navigate = useNavigate()
  const forgetSession = useForgetSession()

  const signOut = useMutation({
    ...logoutMutation(),
    // Even a failed sign-out ends it here: the cookie may already be gone.
    onSettled: async () => {
      await forgetSession()
      await navigate('/login', { replace: true })
    },
  })

  return (
    <Button
      variant="danger"
      disabled={signOut.isPending}
      onClick={() => {
        // While the session is still alive, end this device's secret chats.
        void Promise.allSettled([clearSecretChats(), beforeSignOut?.()]).finally(() => {
          signOut.mutate({})
        })
      }}
    >
      Выйти
    </Button>
  )
}
