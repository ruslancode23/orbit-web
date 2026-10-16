import { Link, useParams } from 'react-router'

import { JoinRoom } from '@/features/join-room'

// Same rule as the server's VoiceTokenRequest.room.
const ROOM_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

export function RoomPage() {
  const { roomId = '' } = useParams()

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 p-6">
      {ROOM_NAME.test(roomId) ? (
        <JoinRoom room={roomId} />
      ) : (
        <p role="alert" className="text-center">
          Такой комнаты не бывает: имя может содержать латинские буквы, цифры, «-» и «_».{' '}
          <Link to="/" className="text-accent underline">
            На главную
          </Link>
        </p>
      )}
    </main>
  )
}
