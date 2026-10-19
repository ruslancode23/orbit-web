function required(name: string): string {
  const value: unknown = import.meta.env[name]
  if (typeof value !== 'string' || value === '') {
    throw new Error(`Environment variable ${name} is not set. See .env.example.`)
  }
  return value
}

/** A positive whole number from the environment, or the fallback when it is not set. */
function positiveInteger(name: string, fallback: number): number {
  const value: unknown = import.meta.env[name]
  if (typeof value !== 'string' || value === '') {
    return fallback
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer, got ${value}.`)
  }
  return parsed
}

export const env = {
  apiUrl: required('VITE_API_URL'),
  /**
   * The largest attachment the server takes (`ORBIT_MAX_UPLOAD_BYTES` there).
   * The API does not report it, so the client is told the same number to
   * refuse a big file before sending it; the server still checks on its own.
   */
  maxUploadBytes: positiveInteger('VITE_MAX_UPLOAD_BYTES', 25 * 1024 * 1024),
} as const
