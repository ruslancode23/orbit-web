import { toApiError } from './api-error'
import { client } from './generated/client.gen'

// Every request of the generated SDK and TanStack Query functions rejects with ApiError.
client.interceptors.error.use((error, response, _request, options) =>
  toApiError(error, response, options.signal),
)
