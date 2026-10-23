import { useId, useState } from 'react'

import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'
import { useToast } from '@/shared/ui/toast'

import { usePushSubscription, type PushState } from '../model/push-subscription'

const HINT: Record<PushState, string> = {
  loading: 'Проверяем, умеет ли браузер…',
  unsupported:
    'Этот браузер так не умеет. На iPhone и iPad сначала добавьте Orbit на экран «Домой», в обычной вкладке Safari push не работает.',
  'server-off': 'На этом сервере Orbit push-уведомления выключены.',
  denied:
    'Браузер запретил уведомления для Orbit — разрешите их в настройках сайта и включите снова.',
  off: 'Личные сообщения и упоминания придут, даже когда вкладка Orbit закрыта. Текст сообщения в уведомление не попадает.',
  on: 'Включено на этом устройстве. Пока Orbit открыт, уведомления показывает сама вкладка.',
}

/** Web Push for this browser: notifications while no Orbit tab is open. */
export const PushSettings = () => {
  const id = useId()
  const toast = useToast()
  const { state, enable, disable, pending } = usePushSubscription()
  const [busy, setBusy] = useState(false)

  const toggle = (next: boolean) => {
    setBusy(true)
    void (next ? enable() : disable())
      .catch(() => {
        toast(
          next ? 'Не удалось включить push-уведомления.' : 'Не удалось выключить push-уведомления.',
          'danger',
        )
      })
      .finally(() => {
        setBusy(false)
      })
  }

  const available = state === 'off' || state === 'on' || state === 'denied'

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id} className="text-sm">
          Когда Orbit закрыт
        </Label>
        <p id={`${id}-hint`} className="text-xs text-fg-muted">
          {HINT[state]}
        </p>
      </div>
      <Switch
        id={id}
        aria-describedby={`${id}-hint`}
        checked={state === 'on'}
        disabled={!available || busy || pending}
        onCheckedChange={toggle}
      />
    </div>
  )
}
