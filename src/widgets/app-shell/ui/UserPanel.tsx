import { useState } from 'react'

import { useLive, useMyStatus } from '@/entities/live'
import { useSession } from '@/entities/session'
import { UserAvatar, userDisplayName } from '@/entities/user'
import { useVoiceRoom } from '@/entities/voice-room'
import { DeviceMenu } from '@/features/select-device'
import { EditProfileDialog, SetStatusDialog } from '@/features/user-card'
import { Avatar } from '@/shared/ui/avatar'
import {
  HeadphonesIcon,
  HeadphonesOffIcon,
  MicIcon,
  MicOffIcon,
  SettingsIcon,
} from '@/shared/ui/icon'
import { IconButton } from '@/shared/ui/icon-button'
import { useToast } from '@/shared/ui/toast'

import { UserSettings } from './UserSettings'
import { UserStatusMenu } from './UserStatusMenu'

const CONNECTION = {
  connecting: { text: 'Подключаемся к серверу…', className: 'bg-warning' },
  open: { text: 'На связи', className: 'bg-success' },
  reconnecting: { text: 'Связь прервалась, пробуем вернуться…', className: 'bg-warning' },
  offline: { text: 'Нет связи с сервером', className: 'bg-danger' },
} as const

/**
 * The person at the bottom of the sidebar: who they are, whether the live
 * connection is up, and the controls that belong to them — status, microphone,
 * sound and settings. Mute and deafen work before joining a voice channel.
 */
export const UserPanel = () => {
  const { user } = useSession()
  const { status } = useLive()
  const { status: presence, choose } = useMyStatus()
  const { isMicrophoneMuted, isDeafened, setMicrophoneMuted, setDeafened } = useVoiceRoom()
  const toast = useToast()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)

  const connection = CONNECTION[status]
  const name = user ? userDisplayName(user) : '…'

  const toggleMicrophone = async () => {
    try {
      await setMicrophoneMuted(!isMicrophoneMuted)
    } catch {
      toast('Не удалось переключить микрофон. Проверьте, что он подключён.', 'danger')
    }
  }

  const toggleDeafen = async () => {
    try {
      await setDeafened(!isDeafened)
    } catch {
      toast('Не удалось переключить звук.', 'danger')
    }
  }

  const avatar = (
    <span className="relative shrink-0">
      {user ? (
        <UserAvatar profile={user} size={32} decorative />
      ) : (
        <Avatar name="…" size={32} decorative />
      )}
      <span
        aria-hidden="true"
        title={connection.text}
        className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-surface ${connection.className}`}
      />
      <span className="sr-only">{connection.text}</span>
    </span>
  )

  const identity = (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="block truncate text-sm font-medium">{name}</span>
      {user?.isGuest === true && (
        <span className="w-fit rounded bg-surface-hover px-1 text-[10px] tracking-wide text-fg-muted uppercase">
          гость
        </span>
      )}
    </span>
  )

  return (
    <>
      <section
        aria-label="Пользователь"
        className="flex flex-col gap-1.5 rounded-md bg-surface p-2"
      >
        <div className="flex min-w-0 items-center gap-2">
          {user ? (
            <UserStatusMenu
              status={presence}
              onStatusChange={choose}
              onEditProfile={() => {
                setEditOpen(true)
              }}
              onSetStatus={() => {
                setStatusOpen(true)
              }}
            >
              {avatar}
              {identity}
            </UserStatusMenu>
          ) : (
            <>
              {avatar}
              <p className="truncate text-sm font-medium">{name}</p>
            </>
          )}

          <IconButton
            label="Настройки пользователя"
            onClick={() => {
              setSettingsOpen(true)
            }}
          >
            <SettingsIcon />
          </IconButton>
        </div>

        <div className="flex items-center gap-0.5">
          <IconButton
            label={isMicrophoneMuted ? 'Включить микрофон' : 'Выключить микрофон'}
            tooltip={isMicrophoneMuted ? 'Включить микрофон' : 'Выключить микрофон (Ctrl+Shift+M)'}
            pressed={isMicrophoneMuted}
            onClick={() => void toggleMicrophone()}
          >
            {isMicrophoneMuted ? <MicOffIcon className="text-danger" /> : <MicIcon />}
          </IconButton>
          <DeviceMenu kind="audioinput" />
          <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
          <IconButton
            label={isDeafened ? 'Включить звук' : 'Выключить звук'}
            tooltip={
              isDeafened
                ? 'Включить звук'
                : 'Выключить звук (Ctrl+Shift+D): вы никого не слышите, микрофон тоже выключается'
            }
            pressed={isDeafened}
            onClick={() => void toggleDeafen()}
          >
            {isDeafened ? <HeadphonesOffIcon className="text-danger" /> : <HeadphonesIcon />}
          </IconButton>
          <DeviceMenu kind="audiooutput" />
        </div>
      </section>

      <UserSettings open={settingsOpen} onOpenChange={setSettingsOpen} />

      {user && editOpen && (
        <EditProfileDialog
          profile={user}
          onClose={() => {
            setEditOpen(false)
          }}
        />
      )}

      {user && statusOpen && (
        <SetStatusDialog
          profile={user}
          onClose={() => {
            setStatusOpen(false)
          }}
        />
      )}
    </>
  )
}
