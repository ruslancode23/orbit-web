import type { Message } from '@/shared/api'

export type { Message }

/**
 * Messages one after another from the same person within this window are shown
 * as one block: the name and time are printed once.
 */
const GROUP_WINDOW_MS = 5 * 60 * 1000

export function startsNewGroup(message: Message, previous: Message | undefined): boolean {
  if (!previous) {
    return true
  }
  if (previous.author?.id !== message.author?.id) {
    return true
  }
  const gap = message.createdAt.getTime() - previous.createdAt.getTime()
  return gap > GROUP_WINDOW_MS
}

/** Hours and minutes, the way a chat shows them. */
export function formatTime(moment: Date): string {
  return moment.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
}

/** The exact moment for a tooltip: the day and the time. */
export function formatFullTime(moment: Date): string {
  return moment.toLocaleString('ru', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const RELATIVE = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' })

/**
 * How long ago a message was written, in words: «только что», «5 минут назад»,
 * «2 дня назад». Older than a week, the date itself says more.
 */
export function formatRelativeTime(moment: Date, now: Date = new Date()): string {
  const seconds = Math.round((moment.getTime() - now.getTime()) / 1000)
  const minutes = Math.round(seconds / 60)
  const hours = Math.round(minutes / 60)
  const days = Math.round(hours / 24)
  if (Math.abs(seconds) < 60) {
    return 'только что'
  }
  if (Math.abs(minutes) < 60) {
    return RELATIVE.format(minutes, 'minute')
  }
  if (Math.abs(hours) < 24) {
    return RELATIVE.format(hours, 'hour')
  }
  if (Math.abs(days) < 7) {
    return RELATIVE.format(days, 'day')
  }
  return moment.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

/** A string property of a payload that may predate the current contract. */
const stringProperty = (value: object, key: string): string | undefined => {
  const field: unknown = Object.getOwnPropertyDescriptor(value, key)?.value
  return typeof field === 'string' ? field : undefined
}

/** Who wrote it, or a placeholder for an account that is gone. */
export function authorName(message: Message): string {
  const author = message.author
  if (!author) {
    return 'Удалённый аккаунт'
  }
  // The generated type always has a display name, but a message cached before
  // profiles — or an older server — can still send only the nickname.
  const name = (stringProperty(author, 'displayName') ?? '').trim()
  return name === '' ? author.nickname : name
}

/** A one-line version of a message for a reply preview. */
export function messagePreview(message: Message, limit = 120): string {
  if (message.deletedAt !== undefined) {
    return 'Сообщение удалено'
  }
  const content = message.content.replace(/\s+/g, ' ').trim()
  // A message of files alone is previewed by their names.
  const files = message.attachments?.map((file) => file.fileName).join(', ') ?? ''
  const text = content === '' && files !== '' ? `Вложение: ${files}` : content
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
    if (next === '' || !/[\p{L}\p{N}_]/u.test(next)) {
      return true
    }
    from = content.indexOf(token, from + 1)
  }
  return false
}
