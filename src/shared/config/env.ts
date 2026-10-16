function required(name: string): string {
  const value: unknown = import.meta.env[name]
  if (typeof value !== 'string' || value === '') {
    throw new Error(`Environment variable ${name} is not set. See .env.example.`)
  }
  return value
}

export const env = {
  apiUrl: required('VITE_API_URL'),
} as const
