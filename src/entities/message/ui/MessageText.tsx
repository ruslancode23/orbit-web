import { useMemo, useState, type ReactNode } from 'react'

import { parseMessage, type BlockNode, type InlineNode } from '../lib/markdown'

interface MessageTextProps {
  content: string
  /** The nickname to highlight, if this message mentions the reader. */
  mention?: string
}

/**
 * The text of a message: its small formatting language (bold, italic, strike,
 * code, quotes, spoilers, links) and the reader's own mention marked. The
 * parser produces nodes, so no HTML is ever built from a message.
 */
export const MessageText = ({ content, mention }: MessageTextProps) => {
  const blocks = useMemo(() => parseMessage(content), [content])
  return <>{renderBlocks(blocks, mention)}</>
}

const renderBlocks = (blocks: BlockNode[], mention: string | undefined): ReactNode[] => {
  return blocks.map((block, index) => {
    const key = `block-${String(index)}`
    switch (block.type) {
      case 'codeblock':
        return (
          <pre
            key={key}
            className="my-1 overflow-x-auto rounded-md bg-bg p-2 text-xs whitespace-pre"
          >
            <code>{block.code}</code>
          </pre>
        )
      case 'quote':
        return (
          <blockquote key={key} className="my-1 border-l-2 border-border pl-2 text-fg-muted">
            {renderInline(block.children, mention, key)}
          </blockquote>
        )
      case 'paragraph':
        return (
          <span key={key} className="whitespace-pre-wrap">
            {renderInline(block.children, mention, key)}
          </span>
        )
    }
  })
}

const renderInline = (
  nodes: InlineNode[],
  mention: string | undefined,
  prefix: string,
): ReactNode[] => {
  return nodes.map((node, index) => {
    const key = `${prefix}-${String(index)}`
    switch (node.type) {
      case 'text':
        return <HighlightedText key={key} text={node.text} mention={mention} />
      case 'code':
        return (
          <code key={key} className="rounded bg-bg px-1 py-0.5 font-mono text-[0.95em]">
            {node.text}
          </code>
        )
      case 'bold':
        return <strong key={key}>{renderInline(node.children, mention, key)}</strong>
      case 'italic':
        return <em key={key}>{renderInline(node.children, mention, key)}</em>
      case 'strike':
        return <s key={key}>{renderInline(node.children, mention, key)}</s>
      case 'spoiler':
        return <Spoiler key={key}>{renderInline(node.children, mention, key)}</Spoiler>
      case 'link':
        return (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
          >
            {renderInline(node.children, mention, key)}
          </a>
        )
    }
  })
}

/** A spoiler stays covered until the reader asks for it, and can be covered again. */
const Spoiler = ({ children }: { children: ReactNode }) => {
  const [shown, setShown] = useState(false)
  if (shown) {
    return (
      <button
        type="button"
        className="rounded-sm bg-surface-hover px-0.5 text-inherit"
        aria-expanded
        onClick={() => {
          setShown(false)
        }}
      >
        {children}
      </button>
    )
  }
  return (
    <button
      type="button"
      className="rounded-sm bg-fg-muted/40 px-1 text-transparent select-none hover:bg-fg-muted/50"
      aria-label="Показать спойлер"
      onClick={() => {
        setShown(true)
      }}
    >
      Спойлер
    </button>
  )
}

/** The reader's mention, inside whatever formatting it happens to sit in. */
const HighlightedText = ({ text, mention }: { text: string; mention: string | undefined }) => {
  if (!mention) {
    return text
  }
  const token = `@${mention}`
  const nodes: ReactNode[] = []
  let plainFrom = 0
  let found = findMention(text, token)
  while (found !== -1) {
    if (found > plainFrom) {
      nodes.push(text.slice(plainFrom, found))
    }
    nodes.push(
      <mark
        key={`mention-${String(found)}`}
        className="rounded-sm bg-accent/20 px-0.5 font-medium text-fg"
      >
        {token}
      </mark>,
    )
    plainFrom = found + token.length
    found = findMention(text, token, plainFrom)
  }
  if (plainFrom === 0) {
    return text
  }
  if (plainFrom < text.length) {
    nodes.push(text.slice(plainFrom))
  }
  return nodes
}

/** A token must not continue into a longer word: `@Anna` is not inside `@AnnaSmith`. */
const findMention = (content: string, token: string, from = 0): number => {
  let found = content.indexOf(token, from)
  while (found !== -1) {
    const next = content.charAt(found + token.length)
    if (next === '' || !/[\p{L}\p{N}_]/u.test(next)) {
      return found
    }
    found = content.indexOf(token, found + 1)
  }
  return -1
}
