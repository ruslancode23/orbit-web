import type { Message } from '@/shared/api'

export type { Message }

/**
 * Messages one after another from the same person within this window are shown
 * as one block: the name and time are printed once.
 */
const GROUP_WINDOW_MS = 5 * 60 * 1000

export function startsNewGroup(message: Message, previous: Message | undefined): boolean {
  if (!previous) return true
  if (previous.author?.id !== message.author?.id) return true
  const gap = message.createdAt.getTime() - previous.createdAt.getTime()
  return gap > GROUP_WINDOW_MS
}

/** Hours and minutes, the way a chat shows them. */
export function formatTime(moment: Date): string {
  return moment.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
}

/** Who wrote it, or a placeholder for an account that is gone. */
export function authorName(message: Message): string {
  return message.author?.nickname ?? 'Удалённый аккаунт'
}
