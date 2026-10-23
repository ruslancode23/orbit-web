import { usePresenceActivityState, type PresenceChoice } from '@/entities/live'

export type VisibleStatus = Exclude<PresenceChoice, 'auto'>

/** The colour of the dot on the avatar, the same as in the menu. */
export const STATUS_DOT: Record<VisibleStatus, string> = {
  online: 'bg-success',
  idle: 'bg-warning',
  dnd: 'bg-danger',
  invisible: 'bg-fg-muted',
}

export const STATUS_LABEL: Record<VisibleStatus, string> = {
  online: 'В сети',
  idle: 'Не активен',
  dnd: 'Не беспокоить',
  invisible: 'Невидимка',
}

/** What the others see: `auto` follows the tab between online and idle. */
export const useEffectiveStatus = (status: PresenceChoice): VisibleStatus => {
  const activity = usePresenceActivityState()
  return status === 'auto' ? (activity === 'idle' ? 'idle' : 'online') : status
}
