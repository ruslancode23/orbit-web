import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router'

import { useSession } from '@/entities/session'
import { AcceptInvite, GuestJoinForm } from '@/features/accept-invite'
import { isApiError, previewInviteOptions } from '@/shared/api'
import { getPlatform } from '@/shared/platform'
import { Button } from '@/shared/ui/button'
import { Logo } from '@/shared/ui/logo'
import { PageLoader } from '@/shared/ui/page-loader'

/** «1 участник», «2 участника», «5 участников». */
const membersWord = (count: number): string => {
  const lastTwo = count % 100
  const last = count % 10
  if (last === 1 && lastTwo !== 11) {
    return 'участник'
  }
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return 'участника'
  }
  return 'участников'
}

/**
 * The page behind an invite link, open to anyone: it shows what the link leads
 * to before asking for anything. A signed-in account joins with one button; a
 * newcomer gives a name and is in, without a password.
 */
const InvitePage = () => {
  const { code } = useParams()
  const location = useLocation()
  const { user, isSignedIn, isLoading: sessionLoading } = useSession()

  const preview = useQuery({
    ...previewInviteOptions({ path: { code: code ?? '' } }),
    enabled: code !== undefined && code !== '',
    // A dead link is an answer, not something to retry.
    retry: false,
  })

  if (code === undefined || code === '') {
    return <DeadInvite />
  }
  if (preview.isPending || sessionLoading) {
    return <PageLoader />
  }
  if (preview.error) {
    return <DeadInvite network={isApiError(preview.error) && preview.error.isNetworkError} />
  }

  const { workspaceName, memberCount } = preview.data
  const next = encodeURIComponent(location.pathname)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-6">
      <section
        aria-labelledby="invite-title"
        className="flex w-full max-w-md flex-col gap-4 rounded-panel border border-border bg-surface p-6 shadow-popover"
      >
        <Logo className="size-8" />
        <header className="flex flex-col gap-1">
          <p className="text-sm text-fg-muted">Приглашение на сервер</p>
          <h1 id="invite-title" className="text-2xl font-semibold">
            {workspaceName}
          </h1>
          <p className="text-sm text-fg-muted">
            {memberCount} {membersWord(memberCount)}
          </p>
        </header>

        {!getPlatform().links.isDesktop() && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              // The OS hands `orbit://` to the app; a browser without it stays where it is.
              window.location.href = `orbit://invite/${code}`
            }}
          >
            Открыть в приложении
          </Button>
        )}

        {isSignedIn ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Вы вошли как <span className="font-medium">{user?.nickname}</span>.
            </p>
            <AcceptInvite code={code} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <GuestJoinForm code={code} />
            <div className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
              <p className="text-fg-muted">
                Уже есть аккаунт?{' '}
                <Link to={`/login?next=${next}`} className="text-accent hover:underline">
                  Войти
                </Link>
              </p>
              <p className="text-fg-muted">
                Хотите аккаунт?{' '}
                <Link to={`/register?next=${next}`} className="text-accent hover:underline">
                  Зарегистрироваться
                </Link>
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

const DeadInvite = ({ network = false }: { network?: boolean }) => {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-6">
      <section
        aria-labelledby="invite-dead-title"
        className="flex w-full max-w-md flex-col gap-3 rounded-panel border border-border bg-surface p-6 shadow-popover"
      >
        <Logo className="size-8" />
        <h1 id="invite-dead-title" className="text-xl font-semibold">
          Приглашение недействительно
        </h1>
        <p className="text-sm text-fg-muted">
          {network
            ? 'Нет соединения с сервером. Проверьте сеть и откройте ссылку ещё раз.'
            : 'Ссылка истекла, её отозвали или в ней опечатка. Попросите новую у администратора сервера.'}
        </p>
        <Link to="/" className="text-sm text-accent hover:underline">
          На главную
        </Link>
      </section>
    </main>
  )
}

export default InvitePage
