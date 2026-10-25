import type { MessageSearchHit } from '@/shared/api'

/** Markers the server puts around matched words in a headline. */
const HIGHLIGHT_START = '\u0002'
const HIGHLIGHT_END = '\u0003'

/** One piece of a search headline: plain text or a matched word. */
export interface HeadlinePart {
  text: string
  highlighted: boolean
}

/**
 * Splits a headline into plain and highlighted pieces. The server sends the
 * markers, so a message that happens to contain HTML stays text.
 */
export const splitHeadline = (headline: string): HeadlinePart[] => {
  const parts: HeadlinePart[] = []
  let index = 0
  while (index < headline.length) {
    const start = headline.indexOf(HIGHLIGHT_START, index)
    if (start === -1) {
      parts.push({ text: headline.slice(index), highlighted: false })
      break
    }
    if (start > index) {
      parts.push({ text: headline.slice(index, start), highlighted: false })
    }
    const end = headline.indexOf(HIGHLIGHT_END, start + 1)
    if (end === -1) {
      // An unterminated marker is shown as text, not swallowed.
      parts.push({ text: headline.slice(start), highlighted: false })
      break
    }
    parts.push({ text: headline.slice(start + 1, end), highlighted: true })
    index = end + 1
  }
  return parts.filter((part) => part.text !== '')
}

/** Where a hit lives, in the words the result row shows. */
export const searchHitPlace = (hit: MessageSearchHit): string => {
  if (hit.workspaceId !== null && hit.channelName !== null) {
    return `# ${hit.channelName}`
  }
  if (hit.channelName !== null) {
    return hit.channelName
  }
  return 'Личное сообщение'
}

/** The in-app address of a hit: the channel or dialogue, at that message. */
export const searchHitHref = (hit: MessageSearchHit): string => {
  const base =
    hit.workspaceId !== null
      ? `/s/${hit.workspaceId}/${hit.message.channelId}`
      : `/me/${hit.message.channelId}`
  return `${base}?at=${String(hit.message.seq)}`
}
