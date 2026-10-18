import { Link } from 'react-router'

import { useSession } from '@/entities/session'
import { LogoutButton } from '@/features/auth'
import { Button } from '@/shared/ui/button'

export function HomePage() {
  const { user } = useSession()

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold">Orbit</h1>
      <p className="text-fg-muted">
        {user ? `Вы вошли как ${user.nickname}` : 'Голосовые комнаты для своих.'}
      </p>
      <Button asChild>
        <Link to="/room/dev-room">Открыть тестовую комнату</Link>
      </Button>
      <LogoutButton />
    </main>
  )
}
