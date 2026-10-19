import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import { useForgetSession } from '@/entities/session'
import { logoutMutation } from '@/shared/api'
import { Button } from '@/shared/ui/button'

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
        signOut.mutate({})
      }}
    >
      Выйти
    </Button>
  )
}
