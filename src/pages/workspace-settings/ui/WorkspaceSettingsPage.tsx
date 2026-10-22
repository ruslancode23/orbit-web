import { Link, Navigate, useParams } from 'react-router'

import { hasPermission, useWorkspace } from '@/entities/workspace'
import { DeleteWorkspace } from '@/features/delete-workspace'
import { MemberPermissionsForm, WorkspaceOverviewForm } from '@/features/edit-workspace'
import { Skeleton } from '@/shared/ui/skeleton'

import type { ReactNode } from 'react'

/**
 * Settings of one server, for its admins and owner; a member is sent back to
 * the server — the server would refuse every change anyway. Deleting is the
 * owner's alone. Changes by others arrive live and show up here as they come.
 */
const WorkspaceSettingsPage = () => {
  const { workspaceId } = useParams()
  const { membership, isLoading } = useWorkspace(workspaceId)

  if (isLoading) {
    return (
      <div role="status" aria-label="Загружаем настройки" className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }
  if (!membership) {
    return <Navigate to="/" replace />
  }
  if (!hasPermission(membership, 'manageServer')) {
    return <Navigate to={`/s/${membership.workspace.id}`} replace />
  }

  const { workspace } = membership
  const isOwner = membership.role === 'owner'

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-8">
        <header className="flex flex-col gap-2">
          <Link
            to={`/s/${workspace.id}`}
            className="self-start text-sm text-fg-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            ← К серверу
          </Link>
          <h1 className="text-2xl font-semibold">Настройки сервера</h1>
          <nav aria-label="Разделы настроек" className="flex gap-4 text-sm">
            <a href="#overview" className="text-fg-muted hover:text-fg">
              Обзор
            </a>
            <a href="#permissions" className="text-fg-muted hover:text-fg">
              Права участников
            </a>
            {isOwner && (
              <a href="#delete" className="text-fg-muted hover:text-fg">
                Удаление сервера
              </a>
            )}
          </nav>
        </header>

        <Section id="overview" title="Обзор">
          <WorkspaceOverviewForm workspace={workspace} />
        </Section>

        <Section id="permissions" title="Права участников">
          <MemberPermissionsForm workspace={workspace} />
        </Section>

        {isOwner && (
          <Section id="delete" title="Удаление сервера">
            <p className="text-sm text-fg-muted">
              Сервер исчезнет у всех участников вместе с каналами, сообщениями и файлами.
            </p>
            <div>
              <DeleteWorkspace workspace={workspace} />
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

const Section = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-4 flex-col gap-4 rounded-lg border border-border p-6"
    >
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  )
}

export default WorkspaceSettingsPage
