import type { ReactNode } from 'react'

interface FriendsEmptyProps {
  icon: ReactNode
  title: string
  description: string
}

/**
 * An empty tab, said in words. The status role announces it when a tab
 * opens, so nobody has to guess whether the list is empty or still loading.
 */
export const FriendsEmpty = ({ icon, title, description }: FriendsEmptyProps) => {
  return (
    <div role="status" className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full bg-surface-hover text-fg-muted [&>svg]:size-7"
      >
        {icon}
      </span>
      <p className="text-sm font-medium text-fg">{title}</p>
      <p className="max-w-xs text-sm text-fg-muted">{description}</p>
    </div>
  )
}
