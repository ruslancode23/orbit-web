/**
 * JSON for request bodies. The generated serializer writes int64 fields
 * (`bigint` on our side, such as a read cursor `seq`) as strings, and the
 * server rejects a string where its schema says integer. They go out as
 * numbers instead; past 2^53 a number would be silently wrong, so that fails.
 */
export function serializeJsonBody(body: unknown): string {
  return JSON.stringify(body, (_key, value: unknown) => {
    if (typeof value !== 'bigint') return value
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new RangeError(`${String(value)} does not fit a JSON number exactly`)
    }
    return Number(value)
  })
}
