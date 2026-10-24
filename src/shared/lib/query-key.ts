/**
 * TanStack Query hashes a key with `JSON.stringify`, which throws on a bigint.
 * Cursors (`seq`, `before`) are int64 and therefore bigints on the client; the
 * hash turns them into strings, so an infinite query can page by one.
 */
export const hashQueryKeyWithBigints = (queryKey: readonly unknown[]): string =>
  JSON.stringify(queryKey, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  )
