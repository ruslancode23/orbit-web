import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import { useForgetSession } from '@/entities/session'
import { logoutMutation } from '@/shared/api'
import { Button } from '@/shared/ui/button'

import { clearSecretChats } from '../model/clear-secret-chats'

export const LogoutButton = () => {
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
        void clearSecretChats().finally(() => {
          signOut.mutate({})
        })
      }}
    >
      Выйти
    </Button>
  )
}
