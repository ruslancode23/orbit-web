const graphemes = new Intl.Segmenter('ru', { granularity: 'grapheme' })

/** The characters a person sees, so an emoji is never cut in half. */
const letters = (word: string): string[] =>
  Array.from(graphemes.segment(word), (part) => part.segment)

/**
 * Up to two letters for a server without an icon: the first letters of the
 * first two words, or the first two of a single word.
 */
export function initials(name: string): string {
  const [first, second] = name.trim().split(/\s+/).filter(Boolean)
  if (!first) {
    return '?'
  }
  const picked = second
    ? [...letters(first).slice(0, 1), ...letters(second).slice(0, 1)]
    : letters(first).slice(0, 2)
  return picked.join('').toLocaleUpperCase('ru')
}

/** How many avatar backgrounds the theme has (`--color-avatar-N`). */
export const AVATAR_COLOR_COUNT = 6

/**
 * Which background a server gets: the same key always picks the same one.
 * The key is the server id where there is one, so a rename keeps the colour.
 */
export function avatarColorIndex(key: string): number {
  let hash = 0
  for (const char of key) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 1_000_003
  }
  return hash % AVATAR_COLOR_COUNT
}
