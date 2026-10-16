import { useEffect, useState, type ComponentProps } from 'react'

import { cn } from '@/shared/lib/cn'

import type { VideoTrack as LiveKitVideoTrack } from 'livekit-client'

interface VideoTrackProps extends Omit<ComponentProps<'video'>, 'ref'> {
  track: LiveKitVideoTrack
}

/** Plays a LiveKit video track; detaches when the track or the component goes away. */
export function VideoTrack({ track, className, ...props }: VideoTrackProps) {
  const [element, setElement] = useState<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!element) return
    track.attach(element)
    return () => {
      track.detach(element)
    }
  }, [track, element])

  return (
    <video
      ref={setElement}
      autoPlay
      playsInline
      muted
      className={cn('h-full w-full bg-black object-contain', className)}
      {...props}
    />
  )
}
