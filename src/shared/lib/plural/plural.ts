/**
 * Picks the Russian form for a count: `pluralRu(5, ['реакция', 'реакции', 'реакций'])`
 * gives «реакций». Intl.PluralRules would do it too, but needs the forms anyway.
 */
export function pluralRu(count: number, [one, few, many]: readonly [string, string, string]) {
  const lastTwo = Math.abs(count) % 100
  const last = lastTwo % 10
  if (last === 1 && lastTwo !== 11) return one
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few
  return many
}
