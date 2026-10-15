import { env } from '@/shared/config'

import { createApiClient } from './client'

/** Client for orbit-server. */
export const api = createApiClient(env.apiUrl)
