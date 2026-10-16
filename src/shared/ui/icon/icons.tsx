import type { ComponentProps, ReactNode } from 'react'

type IconProps = Omit<ComponentProps<'svg'>, 'children'>

/** Decorative 24×24 stroke icons; the control next to them carries the accessible name. */
function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
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

export function MicIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </Icon>
  )
}

export function MicOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15 10V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 5 2.2M5 11a7 7 0 0 0 11.5 5.4M19 11a7 7 0 0 1-.4 2.3M12 18v3M3 3l18 18" />
    </Icon>
  )
}

export function HeadphonesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 18v-6a8 8 0 0 1 16 0v6M4 15h3v6H4zM17 15h3v6h-3z" />
    </Icon>
  )
}

export function HeadphonesOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 18v-6a8 8 0 0 1 1.7-4.9M8.6 4.6A8 8 0 0 1 20 12v4M4 15h3v6H4zM17 15h3v2M3 3l18 18" />
    </Icon>
  )
}

export function VolumeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </Icon>
  )
}
