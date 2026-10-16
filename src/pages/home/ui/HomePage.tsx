import { Link } from 'react-router'

import { Button } from '@/shared/ui/button'

export function HomePage() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold">Orbit</h1>
      <p className="text-fg-muted">Голосовые комнаты для своих.</p>
      <Button asChild>
        <Link to="/room/dev-room">Открыть тестовую комнату</Link>
      </Button>
    </main>
  )
}
