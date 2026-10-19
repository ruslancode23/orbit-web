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

/** A one-line version of a message for a reply preview. */
export function messagePreview(message: Message, limit = 120): string {
  if (message.deletedAt !== undefined) return 'Сообщение удалено'
  const text = message.content.replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}

/** Nicknames are typed into the text as `@nickname`; the server only stores ids. */
export function mentionToken(nickname: string): string {
  return `@${nickname}`
}

/**
 * Accounts the text mentions, for the send body: the server does not parse the
 * text, so the client says explicitly whom it named. A token must not continue
 * into a longer word, otherwise `@Anna` would match inside `@AnnaSmith`.
 */
export function mentionedIds(
  content: string,
  people: readonly { id: string; nickname: string }[],
): string[] {
  return people
    .filter((person) => mentions(content, mentionToken(person.nickname)))
    .map((person) => person.id)
    .slice(0, 50)
}

function mentions(content: string, token: string): boolean {
  let from = content.indexOf(token)
  while (from !== -1) {
    const next = content.charAt(from + token.length)
    if (next === '' || !/[\p{L}\p{N}_]/u.test(next)) return true
    from = content.indexOf(token, from + 1)
  }
  return false
}
