import { env } from '@/shared/config'

import type { CreateClientConfig } from './generated/client.gen'

/** Called by the generated client once, before the first request. */
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: env.apiUrl,
  throwOnError: true,
})
