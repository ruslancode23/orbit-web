/**
 * The length of a text as the server counts it: in characters (Unicode code
 * points, Go runes), not UTF-16 units — an emoji counts once, not twice.
 */
export function characterCount(text: string): number {
  return Array.from(text).length
}
