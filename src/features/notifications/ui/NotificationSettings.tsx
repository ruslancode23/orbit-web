import { useId, useState, type ChangeEvent } from 'react'

import { getPlatform, type NotificationPermissionState } from '@/shared/platform'
import { Button } from '@/shared/ui/button'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'

import {
  setFriendNotificationsEnabled,
  useFriendNotificationsEnabled,
} from '../model/friend-notifications'
import {
  NOTIFICATION_MODES,
  setNotificationMode,
  useNotificationMode,
  type NotificationMode,
} from '../model/mode'

const isMode = (value: string): value is NotificationMode =>
  NOTIFICATION_MODES.some((mode) => mode.value === value)

/**
 * Which messages notify, and the browser's permission for it. The permission
 * is asked only when the person turns notifications on or presses the button:
 * a prompt on page load is one people learn to dismiss.
 */
export const NotificationSettings = () => {
  const fieldId = useId()
  const friendsId = useId()
  const mode = useNotificationMode()
  const friendsEnabled = useFriendNotificationsEnabled()
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    getPlatform().notifications.permission(),
  )

  const askPermission = async () => {
    setPermission(await getPlatform().notifications.requestPermission())
  }

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value
    if (!isMode(next)) {
      return
    }
    setNotificationMode(next)
    if (next !== 'off' && permission === 'default') {
      void askPermission()
    }
  }

  const handleFriendsChange = (next: boolean) => {
    setFriendNotificationsEnabled(next)
    if (next && permission === 'default') {
      void askPermission()
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={fieldId} className="text-xs text-fg-muted">
        Уведомления
      </Label>
      <select
        id={fieldId}
        value={mode}
        onChange={handleChange}
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        {NOTIFICATION_MODES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      {mode !== 'off' && permission === 'default' && (
        <Button variant="ghost" onClick={() => void askPermission()}>
          Разрешить уведомления
        </Button>
      )}
      {mode !== 'off' && permission === 'denied' && (
        <p className="text-xs text-fg-muted">
          Браузер запретил уведомления — разрешите их в настройках сайта.
        </p>
      )}
      {mode !== 'off' && permission === 'unsupported' && (
        <p className="text-xs text-fg-muted">Этот браузер не показывает уведомления.</p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={friendsId} className="text-sm">
            Заявки в друзья
          </Label>
          <p className="text-xs text-fg-muted">
            Входящая заявка и заявка, которую приняли. «Не беспокоить» выключает их, как и
            остальные.
          </p>
        </div>
        <Switch id={friendsId} checked={friendsEnabled} onCheckedChange={handleFriendsChange} />
      </div>
    </div>
  )
}
