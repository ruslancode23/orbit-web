import { Link, useSearchParams } from 'react-router'

import { ResetPasswordForm } from '@/features/auth'
import { Logo } from '@/shared/ui/logo'

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg p-6">
      <div className="flex flex-col items-center gap-2">
        <Logo className="size-10" />
        <span className="text-lg font-semibold">Orbit</span>
      </div>
      <div className="w-full max-w-sm rounded-panel border border-border bg-surface p-6 shadow-popover">
        <ResetPasswordForm token={token} />
      </div>
      <Link to="/beta" className="text-xs text-fg-muted underline underline-offset-2 hover:text-fg">
        О закрытой бете: что есть, чего нет и какие данные мы храним
      </Link>
    </main>
  )
}

export default ResetPasswordPage
