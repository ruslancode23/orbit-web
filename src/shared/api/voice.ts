import { api } from './api'

// Written by hand until orbit-server publishes OpenAPI (SCRUM-18).

export interface VoiceTokenRequest {
  room: string
  displayName: string
}

export interface VoiceToken {
  token: string
  /** LiveKit URL to connect to. */
  url: string
  identity: string
  expiresAt: Date
}

interface VoiceTokenResponse {
  token: string
  url: string
  identity: string
  expiresAt: string
}

/** Development-only endpoint: the server mounts it only with ORBIT_ENV=development. */
export async function requestVoiceToken(
  request: VoiceTokenRequest,
  signal?: AbortSignal,
): Promise<VoiceToken> {
  const response = await api<VoiceTokenResponse>('/api/v1/voice/token', {
    method: 'POST',
    body: request,
    signal,
  })
  return { ...response, expiresAt: new Date(response.expiresAt) }
}
