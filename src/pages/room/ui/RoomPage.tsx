import { Link, useParams } from 'react-router'

import { VoiceRoomProvider } from '@/entities/voice-room'
import { JoinRoom } from '@/features/join-room'
import { ReconnectRoom } from '@/features/reconnect-room'
import { ScreenShares, ShareScreenButton } from '@/features/share-screen'
import { VoiceRoom } from '@/widgets/voice-room'

// Same rule as the server's VoiceTokenRequest.room.
const ROOM_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

const RoomPage = () => {
  const { roomId = '' } = useParams()

  if (!ROOM_NAME.test(roomId)) {
    return (
      <main className="flex h-full items-center justify-center p-6">
        <p role="alert" className="text-center">
          Такой комнаты не бывает: имя может содержать латинские буквы, цифры, «-» и «_».{' '}
          <Link to="/" className="text-accent underline">
            На главную
          </Link>
        </p>
      </main>
    )
  }

  return (
    <VoiceRoomProvider>
      <main className="flex min-h-full flex-col items-center gap-6 p-6 lg:flex-row lg:items-start lg:justify-center">
        <div className="flex w-full max-w-sm flex-col gap-4">
          <ReconnectRoom room={roomId} />
          <JoinRoom room={roomId} />
          <VoiceRoom />
          <ShareScreenButton />
        </div>
        <div className="w-full max-w-4xl">
          <ScreenShares />
        </div>
      </main>
    </VoiceRoomProvider>
  )
}

export default RoomPage
