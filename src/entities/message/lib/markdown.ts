/**
 * The small formatting language of a message: bold, italic, strike, inline
 * code, fenced code blocks, quotes, spoilers and bare http(s) links. It is
 * parsed here and rendered as React nodes — no HTML string ever reaches the DOM,
 * so a message cannot inject markup.
 *
 * The parser is a single left-to-right scan with a depth limit; there are no
 * nested quantifiers or backreferences, so a long message cannot make it
 * backtrack exponentially.
 */

export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'bold'; children: InlineNode[] }
  | { type: 'italic'; children: InlineNode[] }
  | { type: 'strike'; children: InlineNode[] }
  | { type: 'spoiler'; children: InlineNode[] }
  | { type: 'link'; href: string; children: InlineNode[] }

export type BlockNode =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'quote'; children: InlineNode[] }
  | { type: 'codeblock'; code: string; language: string }

/** How deep emphasis may nest; deeper markers stay literal text. */
const MAX_DEPTH = 8

const isWordChar = (character: string | undefined): boolean =>
  character !== undefined && /[\p{L}\p{N}_]/u.test(character)

const isSpace = (character: string | undefined): boolean =>
  character === undefined || /\s/u.test(character)

/**
 * Parses a message into blocks. Fenced code and quotes are the only block
 * constructs; everything else is a paragraph of inline nodes.
 */
export const parseMessage = (content: string): BlockNode[] => {
  const lines = content.replace(/\r\n?/gu, '\n').split('\n')
  const blocks: BlockNode[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (line.trimStart().startsWith('```')) {
      const language = line.trimStart().slice(3).trim()
      const code: string[] = []
      index += 1
      while (index < lines.length && (lines[index] ?? '').trim() !== '```') {
        code.push(lines[index] ?? '')
        index += 1
      }
      // An unclosed fence runs to the end of the message, as a code block.
      if (index < lines.length) {
        index += 1
      }
      blocks.push({ type: 'codeblock', code: code.join('\n'), language })
      continue
    }
    if (/^>\s?/u.test(line)) {
      const quoted: string[] = []
      while (index < lines.length && /^>\s?/u.test(lines[index] ?? '')) {
        quoted.push((lines[index] ?? '').replace(/^>\s?/u, ''))
        index += 1
      }
      blocks.push({ type: 'quote', children: parseInline(quoted.join('\n')) })
      continue
    }
    const paragraph: string[] = []
    while (
      index < lines.length &&
      !/^>\s?/u.test(lines[index] ?? '') &&
      !(lines[index] ?? '').trimStart().startsWith('```')
    ) {
      paragraph.push(lines[index] ?? '')
      index += 1
    }
    blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n')) })
  }
  return blocks
}

/**
 * Parses one run of inline text. Every marker that has no closing partner is
 * left as typed rather than swallowed.
 */
export const parseInline = (text: string, depth = 0): InlineNode[] => {
  const nodes: InlineNode[] = []
  let plain = ''
  let index = 0

  const flush = () => {
    if (plain !== '') {
      nodes.push({ type: 'text', text: plain })
      plain = ''
    }
  }
  const add = (node: InlineNode) => {
    flush()
    nodes.push(node)
  }

  while (index < text.length) {
    // A link is recognised before any marker: its URL may contain underscores
    // and tildes that are not formatting.
    if (text.startsWith('http://', index) || text.startsWith('https://', index)) {
      const link = readLink(text, index)
      if (link !== undefined) {
        add({ type: 'link', href: link.href, children: [{ type: 'text', text: link.text }] })
        index = link.end
        continue
      }
    }

    const marker = markerAt(text, index)
    if (marker !== undefined && depth < MAX_DEPTH) {
      const parsed = readEmphasis(text, index, marker, depth)
      if (parsed !== undefined) {
        add(parsed.node)
        index = parsed.end
        continue
      }
    }

    plain += text[index] ?? ''
    index += 1
  }
  flush()
  return nodes
}

type Marker = '**' | '*' | '_' | '~~' | '||' | '`'

const markerAt = (text: string, index: number): Marker | undefined => {
  const character = text[index]
  if (
    (character === '*' || character === '_' || character === '~' || character === '|') &&
    text[index + 1] === character
  ) {
    const marker = `${character}${character}`
    if (marker === '**' || marker === '~~' || marker === '||') {
      return marker
    }
    return undefined
  }
  if (character === '*') {
    return canOpenSingle(text, index, '*') ? '*' : undefined
  }
  if (character === '_') {
    return canOpenSingle(text, index, '_') ? '_' : undefined
  }
  if (character === '`') {
    return '`'
  }
  return undefined
}

/** A single `*` or `_` opens emphasis only at a boundary, so `snake_case` stays text. */
const canOpenSingle = (text: string, index: number, marker: '*' | '_'): boolean => {
  const next = text[index + 1]
  if (isSpace(next)) {
    return false
  }
  if (marker === '_') {
    return !isWordChar(text[index - 1])
  }
  return true
}

interface ParsedInline {
  node: InlineNode
  end: number
}

const readEmphasis = (
  text: string,
  start: number,
  marker: Marker,
  depth: number,
): ParsedInline | undefined => {
  if (marker === '`') {
    const close = text.indexOf('`', start + 1)
    if (close === -1 || close === start + 1) {
      return undefined
    }
    return { node: { type: 'code', text: text.slice(start + 1, close) }, end: close + 1 }
  }
  const width = marker.length
  const close = findClosing(text, marker, start + width)
  if (close === -1) {
    return undefined
  }
  const inner = text.slice(start + width, close)
  if (inner.trim() === '') {
    return undefined
  }
  const children = parseInline(inner, depth + 1)
  switch (marker) {
    case '**':
      return { node: { type: 'bold', children }, end: close + width }
    case '~~':
      return { node: { type: 'strike', children }, end: close + width }
    case '||':
      return { node: { type: 'spoiler', children }, end: close + width }
    case '*':
      return { node: { type: 'italic', children }, end: close + width }
    case '_':
      return { node: { type: 'italic', children }, end: close + width }
  }
}

/** The next closing marker that ends a non-empty, non-space-padded run. */
const findClosing = (text: string, marker: Marker, from: number): number => {
  if (marker === '**') {
    const index = text.indexOf('**', from)
    // `**bold *and italic***` closes bold with the last two of the three stars,
    // leaving the first one to close the italic inside.
    if (index !== -1 && text[index + 2] === '*') {
      return index + 1
    }
    return index
  }
  if (marker === '*' || marker === '_') {
    let index = text.indexOf(marker, from)
    while (index !== -1) {
      if (!isSpace(text[index - 1]) && !isWordChar(text[index + 1])) {
        return index
      }
      index = text.indexOf(marker, index + 1)
    }
    return -1
  }
  return text.indexOf(marker, from)
}

interface Link {
  href: string
  text: string
  end: number
}

const TRAILING_PUNCTUATION = /[.,!?;:»«"')\]}]+$/u

const readLink = (text: string, start: number): Link | undefined => {
  let end = start
  while (end < text.length && !/\s/u.test(text[end] ?? '')) {
    end += 1
  }
  let raw = text.slice(start, end)
  const trailing = TRAILING_PUNCTUATION.exec(raw)?.[0] ?? ''
  if (trailing !== '') {
    raw = raw.slice(0, raw.length - trailing.length)
    end -= trailing.length
  }
  if (raw.length <= 'https://'.length) {
    return undefined
  }
  return { href: raw, text: raw, end }
}

/** The text of a message without its markers, for previews and notifications. */
export const plainMessageText = (content: string): string => {
  const textOf = (nodes: InlineNode[]): string =>
    nodes
      .map((node) => {
        switch (node.type) {
          case 'text':
          case 'code':
            return node.text
          case 'link':
          case 'bold':
          case 'italic':
          case 'strike':
          case 'spoiler':
            return textOf(node.children)
        }
      })
      .join('')
  return parseMessage(content)
    .map((block) => (block.type === 'codeblock' ? block.code : textOf(block.children)))
    .join('\n')
}
