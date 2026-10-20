import { lazy, Suspense, type ReactNode } from 'react'

import { PageLoader } from '@/shared/ui/page-loader'

// livekit-client is heavy and only needed once somebody uses voice. The shell
// imports this wrapper, so the first paint stays the text client; the room
// implementation (and LiveKit itself) arrives in its own chunk.
const Implementation = lazy(async () => {
  const module = await import('../model/VoiceRoomProvider')
  return { default: module.VoiceRoomProvider }
})

export const VoiceRoomProvider = ({ children }: { children: ReactNode }) => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Implementation>{children}</Implementation>
    </Suspense>
  )
}
