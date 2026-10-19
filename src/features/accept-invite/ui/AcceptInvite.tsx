import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

import { acceptInviteMutation, listWorkspacesQueryKey } from '@/shared/api'
import { Button } from '@/shared/ui/button'

import { describeAcceptError } from '../model/invite'

interface AcceptInviteProps {
  code: string
}

/**
 * Joins the server behind a link as the account that is already signed in.
 * The server treats a member who opens the link as a way back in, so pressing
 * this twice is harmless.
 */
export const AcceptInvite = ({ code }: AcceptInviteProps) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const accept = useMutation({
    ...acceptInviteMutation(),
    onSuccess: async (membership) => {
      // The new server has to appear in the rail before the page under it.
      await queryClient.invalidateQueries({ queryKey: listWorkspacesQueryKey() })
      await navigate(`/s/${membership.workspace.id}`, { replace: true })
    },
  })

  return (
    <div className="flex flex-col gap-3">
      <Button
        disabled={accept.isPending}
        onClick={() => {
          accept.mutate({ path: { code } })
        }}
      >
        {accept.isPending ? 'Вступаем…' : 'Вступить на сервер'}
      </Button>
      {accept.error && (
        <p role="alert" className="text-sm text-danger">
          {describeAcceptError(accept.error)}
        </p>
      )}
    </div>
  )
}
