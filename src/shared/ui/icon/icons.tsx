import type { ComponentProps, ReactNode } from 'react'

type IconProps = Omit<ComponentProps<'svg'>, 'children'>

/** Decorative 24×24 stroke icons; the control next to them carries the accessible name. */
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

export const MessageIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
    <path d="M8 10h8M8 14h5" />
  </Icon>
)

export const LockIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Icon>
)

export const ShieldIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3 5 6v6c0 4 3 7.2 7 9 4-1.8 7-5 7-9V6z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
)

export const ClockIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
)

export const MicIcon = (props: IconProps) => {
  return (
    <Icon {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </Icon>
  )
}

export const MicOffIcon = (props: IconProps) => {
  return (
    <Icon {...props}>
      <path d="M15 10V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 5 2.2M5 11a7 7 0 0 0 11.5 5.4M19 11a7 7 0 0 1-.4 2.3M12 18v3M3 3l18 18" />
    </Icon>
  )
}

export const HeadphonesIcon = (props: IconProps) => {
  return (
    <Icon {...props}>
      <path d="M4 18v-6a8 8 0 0 1 16 0v6M4 15h3v6H4zM17 15h3v6h-3z" />
    </Icon>
  )
}

export const HeadphonesOffIcon = (props: IconProps) => {
  return (
    <Icon {...props}>
      <path d="M4 18v-6a8 8 0 0 1 1.7-4.9M8.6 4.6A8 8 0 0 1 20 12v4M4 15h3v6H4zM17 15h3v2M3 3l18 18" />
    </Icon>
  )
}

export const VolumeIcon = (props: IconProps) => {
  return (
    <Icon {...props}>
      <path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </Icon>
  )
}

export const SettingsIcon = (props: IconProps) => {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Icon>
  )
}

export const ScreenIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Icon>
)

export const HashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
  </Icon>
)

/** A voice channel: a speaker, quieter than `VolumeIcon` so rows stay calm. */
export const SpeakerIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
  </Icon>
)

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const PhoneOffIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10.7 13.3a16 16 0 0 0 3.3 2.4l1.9-1.9a1 1 0 0 1 1-.2c1 .4 2.1.7 3.2.8a1 1 0 0 1 .9 1V19a2 2 0 0 1-2.2 2A17 17 0 0 1 3.2 6.2 2 2 0 0 1 5.2 4h2.5a1 1 0 0 1 1 .9c.1 1.1.4 2.2.8 3.2a1 1 0 0 1-.2 1zM3 3l18 18" />
  </Icon>
)

export const UsersIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
)

export const PaperclipIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m21.4 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </Icon>
)

export const SendIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m22 2-7 20-4-9-9-4z" />
    <path d="M22 2 11 13" />
  </Icon>
)

export const ReplyIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m9 17-5-5 5-5" />
    <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </Icon>
)

export const EditIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </Icon>
)

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
  </Icon>
)

export const SmileIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
  </Icon>
)

export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)

export const MoreIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </Icon>
)

export const LinkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </Icon>
)

export const LogOutIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </Icon>
)

export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </Icon>
)

export const BellIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Icon>
)

export const XIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
)

export const FileIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </Icon>
)

/** Connection quality of the voice room. */
export const SignalIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 20v-2M9 20v-5M14 20v-8M19 20V6" />
  </Icon>
)

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
)

export const HideIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.6 9.6 0 0 1 12 5c5 0 9 4.5 9 7a11 11 0 0 1-3.1 4.3M6.6 6.6C4.4 8.1 3 10.1 3 12c0 2.5 4 7 9 7a9.8 9.8 0 0 0 4.4-1" />
  </Icon>
)

export const MenuIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icon>
)

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m5 13 4 4L19 7" />
  </Icon>
)

/** Add someone as a friend: a person and a plus. */
export const UserPlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <path d="M19 8v6M16 11h6" />
  </Icon>
)

/** Block an account: the universal no-entry sign. */
export const BanIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.6 5.6 12.8 12.8" />
  </Icon>
)
