import { useVoiceRoom, VideoTrack } from '@/entities/voice-room'

/** Screens other participants are showing. */
export const ScreenShares = () => {
  const { screenShares, isSharingScreen } = useVoiceRoom()

  if (screenShares.length === 0 && !isSharingScreen) {
    return null
  }

  return (
    <section aria-label="Демонстрации экрана" className="flex w-full flex-col gap-3">
      {isSharingScreen && (
        <p role="status" className="text-sm text-fg-muted">
          Вы показываете экран
        </p>
      )}
      {screenShares.map((share) => (
        <figure key={share.track.sid} className="flex flex-col gap-1">
          <div className="aspect-video overflow-hidden rounded-md border border-border">
            <VideoTrack track={share.track} aria-label={`Экран: ${share.participantName}`} />
          </div>
          <figcaption className="text-sm text-fg-muted">
            {share.participantName} показывает экран
          </figcaption>
        </figure>
      ))}
    </section>
  )
}
