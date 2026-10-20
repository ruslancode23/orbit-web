import type { ComponentProps, ReactNode } from 'react'

type IconProps = Omit<ComponentProps<'svg'>, 'children'>

/** Decorative 24×24 stroke icons; the control next to them carries the name. */
const Icon = ({ children, ...props }: IconProps & { children: ReactNode }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

/** A closed padlock: the chat itself, not a lock action. */
export const LockIcon = (props: IconProps) => {
  return (
    <Icon {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Icon>
  )
}

export const ShieldIcon = (props: IconProps) => {
  return (
    <Icon {...props}>
      <path d="M12 3 5 6v6c0 4 3 7.2 7 9 4-1.8 7-5 7-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  )
}

export const ClockIcon = (props: IconProps) => {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  )
}
