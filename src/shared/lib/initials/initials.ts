const graphemes = new Intl.Segmenter('ru', { granularity: 'grapheme' })

/** Up to two letters for an avatar: «Анна Ли» → «АЛ», «bob» → «B». */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(graphemes.segment(word))[0]?.segment ?? '')
    .join('')
  return letters.toLocaleUpperCase('ru') || '?'
}
