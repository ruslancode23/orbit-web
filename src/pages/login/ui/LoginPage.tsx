import { LoginForm } from '@/features/auth'
import { Logo } from '@/shared/ui/logo'

const LoginPage = () => {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg p-6">
      <div className="flex flex-col items-center gap-2">
        <Logo className="size-10" />
        <span className="text-lg font-semibold">Orbit</span>
      </div>
      <div className="w-full max-w-sm rounded-panel border border-border bg-surface p-6 shadow-popover">
        <LoginForm />
      </div>
    </main>
  )
}

export default LoginPage
