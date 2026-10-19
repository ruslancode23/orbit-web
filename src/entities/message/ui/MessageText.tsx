import type { ReactNode } from 'react'

interface MessageTextProps {
  content: string
  /** The nickname to highlight, if this message mentions the reader. */
  mention?: string
}

/**
 * The text of a message with the reader's own mention marked. The server stores
 * mentioned accounts as ids, so the nickname is what the text itself shows.
 */
export const MessageText = ({ content, mention }: MessageTextProps) => {
  if (!mention) return content

  const token = `@${mention}`
  const nodes: ReactNode[] = []
  let plainFrom = 0
  let found = findMention(content, token)
  while (found !== -1) {
    if (found > plainFrom) nodes.push(content.slice(plainFrom, found))
    nodes.push(
      <mark
        key={`mention-${String(found)}`}
        className="rounded-sm bg-accent/20 px-0.5 font-medium text-fg"
      >
        {token}
      </mark>,
    )
    plainFrom = found + token.length
    found = findMention(content, token, plainFrom)
  }
  if (plainFrom === 0) return content
  if (plainFrom < content.length) nodes.push(content.slice(plainFrom))
  return nodes
}

/** A token must not continue into a longer word: `@Anna` is not inside `@AnnaSmith`. */
const findMention = (content: string, token: string, from = 0): number => {
  let found = content.indexOf(token, from)
  while (found !== -1) {
    const next = content.charAt(found + token.length)
    if (next === '' || !/[\p{L}\p{N}_]/u.test(next)) return found
    found = content.indexOf(token, found + 1)
  }
  return -1
}
