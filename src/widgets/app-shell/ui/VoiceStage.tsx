import { useParams } from 'react-router'

import { useVoiceRoom } from '@/entities/voice-room'
import { ScreenShares } from '@/features/share-screen'

/**
 * Screens shown in the active voice channel, above the page the reader is on.
 * The voice channel page draws its own, larger, set: this strip would only
 * duplicate it there.
 */
export const VoiceStage = () => {
  const { channelId } = useParams()
  const { activeChannel, screenShares, isSharingScreen } = useVoiceRoom()

  if (!activeChannel || (screenShares.length === 0 && !isSharingScreen)) {
    return null
  }
  if (activeChannel.id === channelId) {
    return null
  }

  return (
    <div className="border-b border-border p-2">
      <ScreenShares />
    </div>
  )
}
