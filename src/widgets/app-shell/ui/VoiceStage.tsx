import { useVoiceRoom } from '@/entities/voice-room'
import { ScreenShares } from '@/features/share-screen'

/** Screens shown in the active voice channel, above the text page. */
export const VoiceStage = () => {
  const { activeChannel, screenShares, isSharingScreen } = useVoiceRoom()

  if (!activeChannel || (screenShares.length === 0 && !isSharingScreen)) {
    return null
  }

  return (
    <div className="border-b border-border p-2">
      <ScreenShares />
    </div>
  )
}
