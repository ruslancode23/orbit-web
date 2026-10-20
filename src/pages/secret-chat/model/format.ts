/** Seconds left before a message removes itself; never negative. */
export const remainingSeconds = (expiresAt: string, now: number = Date.now()): number => {
  const end = Date.parse(expiresAt)
  if (Number.isNaN(end)) {
    return 0
  }
  return Math.max(0, Math.ceil((end - now) / 1000))
}

/** The share of the timer that is still left, for the small ring. */
export const remainingRatio = (
  createdAt: string,
  expiresAt: string,
  now: number = Date.now(),
): number => {
  const start = Date.parse(createdAt)
  const end = Date.parse(expiresAt)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0
  }
  return Math.min(1, Math.max(0, (end - now) / (end - start)))
}

/** «12 с», «2 мин», «3 ч», «1 д» — as short as the ring beside it. */
export const remainingLabel = (seconds: number): string => {
  if (seconds >= 86_400) {
    return `${String(Math.ceil(seconds / 86_400))} д`
  }
  if (seconds >= 3600) {
    return `${String(Math.ceil(seconds / 3600))} ч`
  }
  if (seconds >= 60) {
    return `${String(Math.ceil(seconds / 60))} мин`
  }
  return `${String(seconds)} с`
}
