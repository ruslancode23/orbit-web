import { env } from '@/shared/config'

import type { CreateClientConfig } from './generated/client.gen'

/** Called by the generated client once, before the first request. */
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: env.apiUrl,
  throwOnError: true,
  // The session lives in an HttpOnly cookie, and the API is on another origin
  // in development: without this the browser would not send it.
  credentials: 'include',
})
