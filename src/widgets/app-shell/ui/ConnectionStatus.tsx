import { useLive } from '@/entities/live'

const TEXT = {
  connecting: 'Подключаемся…',
  open: '',
  reconnecting: 'Связь прервалась, пробуем вернуться…',
  offline: 'Нет связи с сервером. Пробуем снова.',
} as const

/** Says out loud when the live connection is not there; silent while it is. */
export function ConnectionStatus() {
  const { status } = useLive()
  const text = TEXT[status]
  if (!text) return null

  return (
    <p role="status" className="text-sm text-fg-muted">
      {text}
    </p>
  )
}
