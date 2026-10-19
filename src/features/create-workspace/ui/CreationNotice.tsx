import { useLocation, useNavigate } from 'react-router'

import { Button } from '@/shared/ui/button'

import { isCreationState, type CreationProblems } from '../model/creation-notice'

/**
 * Says, in the server just created, what did not work out — the icon or some
 * channels — and that it can be finished later. Nothing to say, nothing shown.
 */
export const CreationNotice = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const state: unknown = location.state
  if (!isCreationState(state)) {
    return null
  }

  return (
    <div
      role="alert"
      className="m-4 flex items-start gap-4 rounded-lg border border-danger bg-surface p-4 text-sm"
    >
      <p className="flex-1">{describe(state.creationProblems)}</p>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          void navigate(location.pathname, { replace: true, state: null })
        }}
      >
        Понятно
      </Button>
    </div>
  )
}

const describe = ({ iconFailed, failedChannels }: CreationProblems): string => {
  const parts: string[] = []
  if (iconFailed) {
    parts.push('не загрузился аватар — его можно добавить в настройках сервера')
  }
  if (failedChannels.length) {
    const names = failedChannels.map((name) => `#${name}`).join(', ')
    parts.push(
      failedChannels.length === 1 ? `не создался канал ${names}` : `не создались каналы ${names}`,
    )
  }
  return `Сервер создан, но ${parts.join('; ')}.`
}
